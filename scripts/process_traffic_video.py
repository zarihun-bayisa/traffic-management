
import argparse
import re
import time
from pathlib import Path

import cv2
import easyocr
import requests


API_URL = "http://localhost:3000/api/traffic-events"

# Prototype filter: tune this to the plate formats you need.
PLATE_PATTERN = re.compile(r"^[A-Z0-9]{5,10}$")


def normalize_text(text):
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--video", required=True, help="Path to recorded video")
    parser.add_argument(
        "--api",
        default=API_URL,
        help="Next.js traffic-events API URL",
    )
    parser.add_argument(
        "--frame-step",
        type=int,
        default=15,
        help="Process every Nth frame",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.65,
        help="Minimum OCR confidence before submitting",
    )
    parser.add_argument(
        "--show-video",
        action="store_true",
        help="Display video while processing",
    )
    args = parser.parse_args()

    video_path = Path(args.video)

    if not video_path.is_file():
        raise SystemExit(f"Video file not found: {video_path}")

    if args.frame_step < 1:
        raise SystemExit("--frame-step must be at least 1")

    print("Loading OCR model...")
    reader = easyocr.Reader(["en"], gpu=False)

    capture = cv2.VideoCapture(str(video_path))

    if not capture.isOpened():
        raise SystemExit("Could not open the video file.")

    frame_number = 0
    last_sent = {}
    cooldown_seconds = 15

    print("Processing video. Press Q in the video window to stop.")

    try:
        while True:
            ok, frame = capture.read()

            if not ok:
                break

            frame_number += 1

            if frame_number % args.frame_step == 0:
                # OCR examines the whole frame. This is a baseline
                # prototype, not a dedicated license-plate detector.
                results = reader.readtext(frame)

                for _box, text, ocr_confidence in results:
                    plate = normalize_text(text)

                    if not PLATE_PATTERN.fullmatch(plate):
                        continue

                    if ocr_confidence < args.min_confidence:
                        continue

                    now = time.time()

                    if now - last_sent.get(plate, 0) < cooldown_seconds:
                        continue

                    try:
                        response = requests.post(
                            args.api,
                            json={
                                "plate_number": plate,
                                "confidence": round(float(ocr_confidence), 4),
                            },
                            timeout=10,
                        )

                        if response.status_code == 201:
                            print("Event saved:", response.json())
                            last_sent[plate] = now
                        else:
                            print(
                                "API error:",
                                response.status_code,
                                response.text,
                            )

                    except requests.RequestException as exc:
                        print("Could not contact Next.js API:", exc)

            if args.show_video:
                cv2.imshow("Traffic Video - Prototype", frame)

                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

    finally:
        capture.release()
        cv2.destroyAllWindows()

    print("Video processing finished.")


if __name__ == "__main__":
    main()

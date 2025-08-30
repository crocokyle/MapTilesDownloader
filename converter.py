from PIL import Image
from pathlib import Path
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional


def convert_to_8bit_png(input_path, output_path):
    try:
        with Image.open(input_path) as img:
            unique_colors = img.getcolors(maxcolors=257)
            if img.mode == 'P' or (unique_colors is not None and len(unique_colors) <= 256):
                print(f"Skipping '{input_path}': It is already an 8-bit or lower color depth image.")
                img.save(output_path, 'PNG')
                return

            quantized_img = img.convert('P')
            quantized_img.save(output_path, 'PNG')
            print(f"Converted '{input_path}' to 8-bit PNG at '{output_path}'")

    except FileNotFoundError:
        print(f"Error: The file at '{input_path}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")


def _process_png_file(path: Path) -> tuple[Path, Optional[Exception]]:
    try:
        tmp_path = path.with_suffix(".tmp.png")
        convert_to_8bit_png(str(path), str(tmp_path))
        tmp_path.replace(path)
        return path, None
    except Exception as e:
        return path, e


def convert_tiles_in_directory(root_dir: Path, max_workers: Optional[int] = None) -> None:
    if not root_dir.exists():
        print(f"Error: '{root_dir}' does not exist.")
        return
    if not root_dir.is_dir():
        print(f"Error: '{root_dir}' is not a directory.")
        return

    png_paths = [p for p in root_dir.rglob("*") if p.is_file() and p.suffix.lower() == ".png"]
    if not png_paths:
        print("No PNG files found.")
        return

    print(f"Found {len(png_paths)} PNG files. Processing with {max_workers or 'default'} workers...")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_process_png_file, path): path for path in png_paths}
        for future in as_completed(futures):
            path = futures[future]
            try:
                processed_path, err = future.result()
                if err is not None:
                    print(f"Failed to process '{processed_path}': {err}")
            except Exception as e:
                print(f"Unexpected error for '{path}': {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="Root directory containing map tiles (default: current directory)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=None,
        help="Maximum number of worker threads (default: ThreadPoolExecutor default)",
    )
    args = parser.parse_args()
    convert_tiles_in_directory(Path(args.directory).resolve(), max_workers=args.workers)
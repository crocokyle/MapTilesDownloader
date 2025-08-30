from PIL import Image
from pathlib import Path
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

try:
    from tqdm import tqdm
except ImportError as exc:
    raise RuntimeError(
        "tqdm is required for the progress bar. Install it with: pip install tqdm"
    ) from exc


def convert_to_8bit_png(input_path, output_path):
    try:
        with Image.open(input_path) as img:
            quantized_img = img.convert('P')
            quantized_img.save(output_path, 'PNG')
        except FileNotFoundError:
            print(f"Error: The file at '{input_path}' was not found.")
        except Exception as e:
            print(f"An error occurred: {e}")

def _process_png_file(path: Path) -> None:
    try:
        tmp_path = path.with_suffix(".tmp.png")
        convert_to_8bit_png(str(path), str(tmp_path))
        tmp_path.replace(path)
    except Exception:
        pass

def convert_tiles_in_directory(root_dir: Path, max_workers: Optional[int] = None) -> None:
    if not root_dir.exists() or not root_dir.is_dir():
        return

    png_paths = [p for p in root_dir.rglob("*") if p.is_file() and p.suffix.lower() == ".png"]
    if not png_paths:
        return

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(_process_png_file, path) for path in png_paths]
        for _ in tqdm(as_completed(futures), total=len(futures), unit="file", leave=False, desc="Converting map tiles to 8-bit"):
            pass

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

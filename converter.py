from PIL import Image
from pathlib import Path
import argparse


def convert_to_8bit_png(input_path, output_path):
    try:
        with Image.open(input_path) as img:
            quantized_img = img.convert('P')
            quantized_img.save(output_path, 'PNG')
        print(f"Converted '{input_path}' to 8-bit PNG at '{output_path}'")

    except FileNotFoundError:
        print(f"Error: The file at '{input_path}' was not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

def convert_tiles_in_directory(root_dir: Path) -> None:
    if not root_dir.exists():
        print(f"Error: '{root_dir}' does not exist.")
        return
    if not root_dir.is_dir():
        print(f"Error: '{root_dir}' is not a directory.")
        return

    for path in root_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() == ".png":
            try:
                tmp_path = path.with_suffix(".tmp.png")
                convert_to_8bit_png(str(path), str(tmp_path))
                tmp_path.replace(path)
                print(f"Overwrote: {path}")
            except Exception as e:
                print(f"Failed to process '{path}': {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "directory",
        nargs="?",
        default=".",
        help="Root directory containing map tiles (default: current directory)",
    )
    args = parser.parse_args()
    convert_tiles_in_directory(Path(args.directory).resolve())

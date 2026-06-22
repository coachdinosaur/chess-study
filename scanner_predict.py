import sys
import json

# Ensure C:\Users\Ronaldo\fen_test is in sys.path
sys.path.append(r"C:\Users\Ronaldo\fen_test")

def compress_fen(raw):
    rows = raw.strip().split("/")
    fixed_rows = []

    for row in rows:
        empty = 0
        fixed = ""

        for ch in row:
            if ch == "1":
                empty += 1
            else:
                if empty:
                    fixed += str(empty)
                    empty = 0
                fixed += ch

        if empty:
            fixed += str(empty)

        fixed_rows.append(fixed)

    return "/".join(fixed_rows)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    try:
        from chessimg2pos import predict_fen
        raw = predict_fen(image_path)
        placement = compress_fen(raw)
        print(json.dumps({"placement": placement}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

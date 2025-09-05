input_path = r"d:\html\s\static\english_content.json"  # file text thường
output_path = r"d:\html\s\static\english_content_filtered.txt"

keywords = ["từ khóa", "không"]

def line_contains_keywords(line, keywords):
    line_lower = line.lower()
    return any(keyword in line_lower for keyword in keywords)

with open(input_path, "r", encoding="utf-8") as f_in, \
     open(output_path, "w", encoding="utf-8") as f_out:
    for line in f_in:
        stripped_line = line.strip()
        if not stripped_line:
            continue  # bỏ dòng trống
        if "==" in stripped_line:
            continue  # bỏ dòng chứa dấu ==
        if line_contains_keywords(stripped_line, keywords):
            continue  # bỏ dòng chứa từ khóa
        # Thay thế dấu " thành `
        replaced_line = stripped_line.replace('"', '`')
        f_out.write(replaced_line + "\n")

print(f"Đã lọc, thay thế và lưu file tại: {output_path}")

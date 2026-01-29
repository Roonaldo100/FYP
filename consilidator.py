file_paths = [
    r'C:\Users\ruben\Desktop\FYPBarcode\FYP\FridgeFriend\app\(tabs)\index.tsx',
    r'C:\Users\ruben\Desktop\FYPBarcode\FYP\FridgeFriend\app\BarcodeScanner.tsx',
    r'C:\Users\ruben\Desktop\FYPBarcode\FYP\FridgeFriend\backend\server.js',
    r'C:\Users\ruben\Desktop\FYPBarcode\FYP\FridgeFriend\lib\notifications.tsx',
    r'C:\Users\ruben\Desktop\FYPBarcode\FYP\FridgeFriend\app\index.tsx'
]

output_file = r'C:\Users\ruben\Desktop\FYPBarcode\FYP\temp.txt'

with open(output_file, 'w', encoding='utf-8') as outfile:
    for file_path in file_paths:
        with open(file_path, 'r', encoding='utf-8') as infile:
            outfile.write(infile.read())
            outfile.write('\n')

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
TEMPLATE_PATH = ROOT / "tarjeta" / "BASE ELECTRONICA TIVE PDF SIN RELLENO PDF.pdf"
OUTPUT_PATH = ROOT / "RESULTADO_TEST_BASE_ELECTRONICA.pdf"
DATA_JSON_PATH = ROOT / "datos1.json"


FIELDS = [
    {"key": "codigo_de_verificacion", "x": 231, "y": 602, "dx": -3, "dy": -7, "font_size": 8, "bold": False},
    {"key": "fecha", "x": 180.8, "y": 577.5, "dx": 0, "dy": -8, "font_size": 8, "bold": False},
    {"key": "zona_registral", "x": 144.0, "y": 482.0, "dx": -14, "dy": 7, "font_size": 8, "bold": False},
    {"key": "sede_registral", "x": 141.0, "y": 467.0, "dx": -18, "dy": 11, "font_size": 8, "bold": False},
    {"key": "parda_registral", "x": 120.9, "y": 452.9, "dx": -3, "dy": -7, "font_size": 8, "bold": False},
    {"key": "duadam", "x": 103.1, "y": 438, "dx": 0, "dy": -7, "font_size": 8, "bold": False},
    {"key": "titulo", "x": 89.3, "y": 422.3, "dx": -8, "dy": -7, "font_size": 8, "bold": False},
    {"key": "fecha_del_titulo", "x": 126.3, "y": 406.6, "dx": -6.5, "dy": -7, "font_size": 8, "bold": False},
    {"key": "categoria", "x": 105.1, "y": 274.4, "dx": -6, "dy": -7, "font_size": 8, "bold": False},
    {"key": "marca", "x": 89.9, "y": 261.1, "dx": -8, "dy": -7, "font_size": 8, "bold": False},
    {"key": "modelo", "x": 96.8, "y": 246.8, "dx": -7, "dy": -7, "font_size": 8, "bold": False},
    {"key": "color", "x": 88.4, "y": 233.2, "dx": -5, "dy": -6, "font_size": 8, "bold": False},
    {"key": "numero_de_vin", "x": 120.5, "y": 220.2, "dx": -5, "dy": -8, "font_size": 8, "bold": False},
    {"key": "numero_de_serie", "x": 128.3, "y": 206.2, "dx": -9, "dy": -8, "font_size": 8, "bold": False},
    {"key": "numero_motor", "x": 118, "y": 191.9, "dx": -5, "dy": -7, "font_size": 8, "bold": False},
    {"key": "carroceria", "x": 104.5, "y": 178.6, "dx": -4, "dy": -8, "font_size": 8, "bold": False},
    {"key": "potencia", "x": 99.6, "y": 164, "dx": -4, "dy": -8, "font_size": 8, "bold": False},
    {"key": "form_rod", "x": 107.6, "y": 150.7, "dx": -6, "dy": -7, "font_size": 8, "bold": False},
    {"key": "combusble", "x": 108.6, "y": 138.4, "dx": -6, "dy": -8, "font_size": 8, "bold": False},
    {"key": "asientos", "x": 104.1, "y": 108.5, "dx": 13, "dy": -4, "font_size": 8, "bold": False},
    {"key": "pasajeros", "x": 103.1, "y": 96.4, "dx": 14, "dy": -6, "font_size": 8, "bold": False},
    {"key": "ruedas", "x": 103.9, "y": 67, "dx": 14, "dy": -3.5, "font_size": 8, "bold": False},
    {"key": "ejes", "x": 103.5, "y": 81.8, "dx": 14 , "dy": -5, "font_size": 8, "bold": False},
    {"key": "placa", "x": 317.9, "y": 406.9, "dx": -6, "dy": -6, "font_size": 25, "bold": True},
    {"key": "año_fabricacion", "x": 392.6, "y": 272.6, "dx": -8, "dy": -7, "font_size": 8, "bold": False},
    {"key": "cilindros", "x": 208.6, "y": 114.2, "dx": 8, "dy": -6, "font_size": 8, "bold": False},
    {"key": "longitud", "x": 213.9, "y": 100.2, "dx": 4, "dy": -5, "font_size": 8, "bold": False},
    {"key": "altura", "x": 213.9, "y": 86.2, "dx": 4, "dy": -5.5, "font_size": 8, "bold": False},
    {"key": "ancho", "x": 212.6, "y": 71.6, "dx": 5, "dy": -4, "font_size": 8, "bold": False},
    {"key": "cilindro", "x": 333.9, "y": 109.6, "dx":12, "dy": -5.5, "font_size": 8, "bold": False},
    {"key": "p_bruto", "x": 326.6, "y": 97.6, "dx": 19, "dy": -6, "font_size": 8, "bold": False},
    {"key": "campo_30", "x": 329.9, "y": 82.9, "dx": 16, "dy": -5, "font_size": 8, "bold": False},
    {"key": "campo_31", "x": 322.6, "y": 71.6, "dx": 24, "dy": -6, "font_size": 8, "bold": False},
    {"key": "version", "x": 273.9, "y": 155.9, "dx": -3, "dy": -8, "font_size": 8, "bold": False},
    {"key": "año_modelo", "x": 396.6, "y": 262.9, "dx": -6, "dy": -8, "font_size": 8, "bold": False},
    {"key": "titulo_numero", "x": 190.6, "y": 590.2, "dx": -6.5, "dy": -8, "font_size": 8, "bold": False},
    {"key": "qr", "x": 102.6, "y": 333.9, "dx": 0, "dy": -8, "font_size": 8, "bold": False},
]


DEMO_DATA = {
    "codigo_de_verificacion": "CV-9X72-41Q",
    "fecha": "17/05/2026",
    "zona_registral": "III",
    "sede_registral": "TARAPOTO",
    "parda_registral": "PARTIDA 11024567",
    "duadam": "DAM 118-2026-10-998877",
    "titulo": "000456-2026",
    "fecha_del_titulo": "12/05/2026",
    "categoria": "M1",
    "marca": "TOYOTA",
    "modelo": "COROLLA XEI",
    "color": "PLATA METALICO",
    "numero_de_vin": "8AJBA3HE0NL123456",
    "numero_de_serie": "JTNKU3JE7GJ123456",
    "numero_motor": "2ZR-9876543",
    "carroceria": "SEDAN",
    "potencia": "103 KW",
    "form_rod": "4X2",
    "combusble": "GASOLINA",
    "asientos": "5",
    "pasajeros": "5",
    "ruedas": "4",
    "ejes": "2",
    "placa": "ABC-123",
    "año_fabricacion": "2025",
    "cilindros": "4",
    "longitud": "4.63 M",
    "altura": "1.44 M",
    "ancho": "1.78 M",
    "cilindro": "1798 CC",
    "p_bruto": "1760 KG",
    "campo_30": "1315 KG",
    "campo_31": "445 KG",
    "version": "1.8 XEI CVT",
    "año_modelo": "2026",
    "titulo_numero": "778899-2026",
    "qr": "",
}


def load_data() -> dict[str, str]:
    if DATA_JSON_PATH.exists():
        loaded = json.loads(DATA_JSON_PATH.read_text(encoding="utf-8"))
        return {**DEMO_DATA, **loaded}
    return DEMO_DATA


FONT_REGULAR_REF = "394 0 R"
FONT_BOLD_REF = "395 0 R"
CONTENT_REF = "396 0 R"
NEW_SIZE = 397


def pdf_escape(text: str) -> str:
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def build_stream() -> bytes:
    source_data = load_data()
    lines = ["q", "BT", "0 0 0 rg"]
    for field in FIELDS:
        value = source_data.get(field["key"], field["key"].upper())
        font_name = "/FTESTB" if field["bold"] else "/FTEST"
        x = field["x"] + field.get("dx", 0)
        y = field["y"] + field.get("dy", 0)
        lines.append(f"{font_name} {field['font_size']} Tf")
        lines.append(f"1 0 0 1 {x:.1f} {y:.1f} Tm")
        lines.append(f"({pdf_escape(value)}) Tj")
    lines.extend(["ET", "Q"])
    stream = "\n".join(lines).encode("latin-1", "replace")
    return (
        b"396 0 obj\n"
        + f"<< /Length {len(stream)} >>\n".encode("ascii")
        + b"stream\n"
        + stream
        + b"\nendstream\nendobj\n"
    )


def parse_last_trailer(pdf_bytes: bytes) -> tuple[int, bytes]:
    startxref_match = re.search(rb"startxref\s+(\d+)\s+%%EOF\s*$", pdf_bytes, re.S)
    if not startxref_match:
        raise RuntimeError("No se encontro startxref en el PDF base.")
    prev_xref = int(startxref_match.group(1))
    trailer_start = pdf_bytes.rfind(b"trailer", 0, startxref_match.start())
    if trailer_start < 0:
        raise RuntimeError("No se encontro trailer en el PDF base.")
    trailer_slice = pdf_bytes[trailer_start:startxref_match.start()]
    trailer_match = re.search(rb"trailer\s*<<(.*?)>>", trailer_slice, re.S)
    if not trailer_match:
        raise RuntimeError("No se pudo leer el trailer del PDF base.")
    return prev_xref, trailer_match.group(1)


def update_page_object(page_obj: bytes) -> bytes:
    updated = page_obj
    updated = re.sub(
        rb"/Contents\s+5\s+0\s+R",
        b"/Contents [5 0 R 396 0 R]",
        updated,
        count=1,
    )
    updated = re.sub(
        rb"/Font\s*<<([^>]*)>>",
        rb"/Font <<\1 /FTEST 394 0 R /FTESTB 395 0 R >>",
        updated,
        count=1,
        flags=re.S,
    )
    return updated


def build_incremental_update(pdf_bytes: bytes) -> bytes:
    page_match = re.search(rb"4\s+0\s+obj(.*?)endobj", pdf_bytes, re.S)
    if not page_match:
        raise RuntimeError("No se encontro el objeto de la pagina 1.")

    original_page_body = page_match.group(1).strip()
    updated_page_body = update_page_object(original_page_body)

    font_regular_obj = (
        b"394 0 obj\n"
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\n"
        b"endobj\n"
    )
    font_bold_obj = (
        b"395 0 obj\n"
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\n"
        b"endobj\n"
    )
    content_obj = build_stream()
    page_obj = b"4 0 obj\n" + updated_page_body + b"\nendobj\n"

    new_objects = [font_regular_obj, font_bold_obj, content_obj, page_obj]
    body = bytearray()
    offsets = {}
    base_offset = len(pdf_bytes)

    for obj in new_objects:
        first_line = obj.splitlines()[0].decode("ascii")
        obj_num = int(first_line.split()[0])
        offsets[obj_num] = base_offset + len(body)
        body.extend(obj)

    prev_xref, trailer_body = parse_last_trailer(pdf_bytes)
    xref_offset = base_offset + len(body)

    xref = (
        "xref\n"
        "4 1\n"
        f"{offsets[4]:010d} 00000 n \n"
        "394 3\n"
        f"{offsets[394]:010d} 00000 n \n"
        f"{offsets[395]:010d} 00000 n \n"
        f"{offsets[396]:010d} 00000 n \n"
    ).encode("ascii")

    cleaned_trailer = re.sub(rb"/Size\s+\d+", b"", trailer_body)
    cleaned_trailer = re.sub(rb"/Prev\s+\d+", b"", cleaned_trailer)
    cleaned_trailer = re.sub(rb"\s+", b" ", cleaned_trailer).strip()

    trailer = (
        b"trailer\n<< /Size "
        + str(NEW_SIZE).encode("ascii")
        + b" /Prev "
        + str(prev_xref).encode("ascii")
        + b" "
        + cleaned_trailer
        + b" >>\nstartxref\n"
        + str(xref_offset).encode("ascii")
        + b"\n%%EOF\n"
    )

    return bytes(body) + xref + trailer


def main() -> None:
    pdf_bytes = TEMPLATE_PATH.read_bytes()
    incremental = build_incremental_update(pdf_bytes)
    OUTPUT_PATH.write_bytes(pdf_bytes + incremental)
    print(f"PDF generado: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

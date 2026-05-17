from __future__ import annotations

import json
import re
import sys
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def extract_pdf_text(pdf_path: Path) -> str:
    pdf_bytes = pdf_path.read_bytes()
    chunks: list[str] = []

    for match in re.finditer(rb'(\d+)\s+0\s+obj\s*<<(.*?)>>\s*stream\r?\n', pdf_bytes, re.S):
        dictionary = match.group(2)
        start = match.end()
        end = pdf_bytes.find(b'endstream', start)
        if end < 0:
            continue

        stream = pdf_bytes[start:end].rstrip(b'\r\n')
        if b'/FlateDecode' in dictionary:
            try:
                data = zlib.decompress(stream)
            except Exception:
                continue
        else:
            data = stream

        for raw in re.findall(rb'\((.*?)\)\s*Tj', data, re.S):
            text = raw.decode('latin1', errors='ignore')
            text = text.replace('\\(', '(').replace('\\)', ')').replace('\\\\', '\\')
            chunks.append(text)

    return '\n'.join(chunks)


def find_value(text: str, label: str) -> str:
    pattern = re.compile(rf'{re.escape(label)}\s+([^\n]+)', re.I)
    match = pattern.search(text)
    return match.group(1).strip() if match else ''


def find_last_value(text: str, label: str) -> str:
    pattern = re.compile(rf'{re.escape(label)}\s+([^\n]+)', re.I)
    matches = pattern.findall(text)
    return matches[-1].strip() if matches else ''


def find_title_number(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for idx, line in enumerate(lines):
        if line.lower() == 'título nro' and idx > 0:
            return lines[idx - 1]
    return ''


def find_title_value(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines:
        if line.lower().startswith('título ') and line.lower() != 'título nro':
            return line.split(' ', 1)[1].strip()
    return ''


def normalize_title_number(value: str) -> str:
    compact = re.sub(r'\s+', '', value or '')
    match = re.fullmatch(r'(\d+)-(\d+)', compact)
    if not match:
        return compact
    year, number = match.groups()
    return f'{number}-{year}'


def normalize_numeric_value(value: str) -> str:
    cleaned = (value or '').strip().replace(',', '.')
    match = re.search(r'\d+(?:\.\d+)?', cleaned)
    return match.group(0) if match else cleaned


def build_json(text: str) -> dict[str, str]:
    fecha_titulo = find_value(text, 'Fecha')
    titulo_no = normalize_title_number(find_title_number(text))

    return {
        "codigo_de_verificacion": "",
        "fecha": fecha_titulo,
        "zona_registral": "",
        "sede_registral": "",
        "parda_registral": find_value(text, 'Partida'),
        "duadam": "",
        "titulo": titulo_no or normalize_title_number(find_title_value(text)),
        "fecha_del_titulo": fecha_titulo.split()[0] if fecha_titulo else "",
        "categoria": find_value(text, 'Categoria'),
        "marca": find_value(text, 'Marca'),
        "modelo": find_value(text, 'Modelo'),
        "color": find_value(text, 'Color'),
        "numero_de_vin": find_value(text, 'Nro. VIN'),
        "numero_de_serie": find_value(text, 'Nro. Serie'),
        "numero_motor": find_value(text, 'Nro. Motor'),
        "carroceria": find_value(text, 'Tipo Carrocería'),
        "potencia": find_value(text, 'Potencia Motor'),
        "form_rod": find_value(text, 'Fórmula Rodante'),
        "combusble": find_value(text, 'Tipo Combustible'),
        "asientos": find_value(text, 'Nro. Asientos'),
        "pasajeros": find_value(text, 'Nro. Pasajeros'),
        "ruedas": find_value(text, 'Nro. Ruedas'),
        "ejes": find_value(text, 'Nro. Ejes'),
        "placa": find_value(text, 'Placa :'),
        "año_fabricacion": find_value(text, 'Año Fabricación'),
        "cilindros": find_value(text, 'Nro. Cilindros'),
        "longitud": normalize_numeric_value(find_value(text, 'Longitud')),
        "altura": normalize_numeric_value(find_value(text, 'Altura')),
        "ancho": normalize_numeric_value(find_value(text, 'Ancho')),
        "cilindro": normalize_numeric_value(find_value(text, 'Cilindrada')),
        "p_bruto": normalize_numeric_value(find_value(text, 'Peso Bruto')),
        "campo_30": normalize_numeric_value(find_value(text, 'Peso Neto')),
        "campo_31": normalize_numeric_value(find_value(text, 'Carga Util')),
        "version": find_value(text, 'Nro. Versión'),
        "año_modelo": find_value(text, 'Año Modelo'),
        "titulo_numero": titulo_no,
        "qr": "",
        "raw_text": text,
    }


def extract_all_pairs(text: str) -> list[dict[str, str]]:
    pairs: list[dict[str, str]] = []
    lines = [line.rstrip() for line in text.splitlines()]

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        colon_match = re.match(r'^([^:]+?)\s*:\s*(.+)$', stripped)
        if colon_match:
            label = colon_match.group(1).strip()
            value = colon_match.group(2).strip()
            if value:
                pairs.append({"label": label, "value": value, "source": "colon"})
            continue

        stripped_left = line.strip()
        if '  ' in stripped_left:
            parts = re.split(r'\s{2,}', stripped_left, maxsplit=1)
            if len(parts) == 2:
                label, value = parts[0].strip(), parts[1].strip()
                if label and value and not set(label) <= {"_"}:
                    pairs.append({"label": label, "value": value, "source": "spaced"})

    deduped: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in pairs:
        key = (item["label"], item["value"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def main() -> None:
    pdf_name = sys.argv[1] if len(sys.argv) > 1 else 'datos1.pdf'
    pdf_path = ROOT / pdf_name
    if not pdf_path.exists():
        raise FileNotFoundError(f'No existe {pdf_path}')

    text = extract_pdf_text(pdf_path)
    data = build_json(text)
    data["all_detected_fields"] = extract_all_pairs(text)

    output_path = ROOT / f'{pdf_path.stem}.json'
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'JSON generado: {output_path}')


if __name__ == '__main__':
    main()

"""Transforma um retrato com emoção (editado por IA) em animação.

Saídas, para cada imagem:
  <nome>.gif         para mostrar e compartilhar
  <nome>_folha.png   folha de quadros lado a lado (256x256 cada), que a jogada usa como textura WebGL
Uso: python fazer-gif.py <imagem> <emocao> <saida_sem_extensao> [retrato_normal]
emocao: rindo | chorando | sofrendo | apavorado | nocauteado
"""
import math
import sys
from PIL import Image, ImageChops, ImageDraw

S, N = 256, 12  # tamanho do quadro e número de quadros (12 a 15 fps)


def quadrado(im):
    w, h = im.size
    sz = int(min(w, h) * 0.92)
    x, y = (w - sz) // 2, int((h - sz) * 0.2)
    return im.convert("RGBA").crop((x, y, x + sz, y + sz)).resize((S, S), Image.LANCZOS)


def movimento(emo, i):
    t = i / N * 2 * math.pi
    if emo == "rindo":
        return dict(sx=1 + 0.05 * math.sin(2 * t), sy=1 - 0.05 * math.sin(2 * t), rot=6 * math.sin(t), dx=0, dy=-8 * abs(math.sin(t)))
    if emo == "sofrendo":
        return dict(sx=0.95, sy=1.05, rot=7 * math.sin(5 * t), dx=6 * math.sin(7 * t), dy=0)
    if emo == "apavorado":
        return dict(sx=1.02, sy=1.02, rot=0, dx=4 * math.sin(9 * t), dy=3 * math.cos(11 * t))
    if emo == "chorando":
        return dict(sx=1, sy=0.98, rot=-4 + 2 * math.sin(t), dx=0, dy=3 * math.sin(2 * t))
    if emo == "nocauteado":
        return dict(sx=1, sy=1, rot=12 * math.sin(t), dx=0, dy=0)
    return dict(sx=1, sy=1, rot=0, dx=0, dy=0)


def quadro(base, m):
    w, h = int(S * m["sx"]), int(S * m["sy"])
    im = base.resize((w, h), Image.LANCZOS).rotate(m["rot"], resample=Image.BICUBIC)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.alpha_composite(im, (int((S - w) / 2 + m["dx"]), int((S - h) / 2 + m["dy"])))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, S - 1, S - 1), fill=255)
    out.putalpha(ImageChops.multiply(out.getchannel("A"), mask))
    return out


def main():
    img, emo, saida = sys.argv[1], sys.argv[2], sys.argv[3]
    base = quadrado(Image.open(img))
    normal = quadrado(Image.open(sys.argv[4])) if len(sys.argv) > 4 else None
    quadros = [quadro(base, movimento(emo, i)) for i in range(N)]
    if normal is not None:  # começa no retrato normal e "vira" a emoção
        quadros = [quadro(normal, movimento("", 0))] * 2 + quadros
    folha = Image.new("RGBA", (S * len(quadros), S))
    for i, q in enumerate(quadros):
        folha.paste(q, (i * S, 0))
    folha.save(saida + "_folha.png")
    fundo = [Image.alpha_composite(Image.new("RGBA", (S, S), (14, 12, 10, 255)), q).convert("P", palette=Image.ADAPTIVE) for q in quadros]
    fundo[0].save(saida + ".gif", save_all=True, append_images=fundo[1:], duration=70, loop=0, disposal=2)
    print(saida, len(quadros), "quadros")


main()

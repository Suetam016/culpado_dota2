"""Remendo no parser do OpenDota para o mapa do site: posição dos clones (Meepo, Arc Warden).

O parser original só dá a posição do herói "principal" de cada jogador (m_hSelectedHero). Os clones do Meepo
(e a Tempest Double do Arc Warden) são outras unidades-herói da mesma classe e somem do mapa. Este remendo:
  1. guarda o handle de toda unidade CDOTA_Unit_Hero_Meepo / CDOTA_Unit_Hero_ArcWarden que entra no replay;
  2. a cada intervalo (1 s), solta um evento "clone" para cada uma que não é o herói principal de ninguém, com o
     slot do dono (mesma classe e mesmo time), x, y, life_state e, em key, campos para separar clone de ilusão.

Roda no workflow do mapa logo depois do git clone do parser:  python mapa/parser_clones.py parser
Se o código do parser mudar e as âncoras sumirem, avisa e não mexe em nada (o mapa continua sem os clones).
"""
from __future__ import annotations

import sys
from pathlib import Path

CLASSES = ("CDOTA_Unit_Hero_Meepo", "CDOTA_Unit_Hero_ArcWarden")

CAMPO = "    float INTERVAL = 1;\n"
CAMPO_NOVO = CAMPO + "    java.util.Set<Integer> culpadoClones = new java.util.LinkedHashSet<>();\n"

ENTROU = "    public void onEntityEntered(Context ctx, Entity e) {\n        String entityName = e.getDtClass().getDtName();\n"
ENTROU_NOVO = ENTROU + (
    "        if (" + " || ".join(f'entityName.equals("{c}")' for c in CLASSES) + ") {\n"
    "            culpadoClones.add(e.getHandle());\n"
    "        }\n"
)

INTERVALO = "                nextInterval += INTERVAL;\n"
INTERVALO_NOVO = """                try {
                    // culpado: clones (Meepo, Arc Warden) = unidades-herói da mesma classe que não são o herói de ninguém
                    Entities culpEnts = ctx.getProcessor(Entities.class);
                    java.util.Map<String, Integer> culpDono = new java.util.HashMap<>();
                    java.util.Set<Integer> culpPrincipais = new java.util.HashSet<>();
                    for (int ci = 0; ci < numPlayers; ci++) {
                        Integer hh = getEntityProperty(pr, "m_vecPlayerTeamData.%i.m_hSelectedHero", validIndices[ci]);
                        Entity he = hh == null ? null : culpEnts.getByHandle(hh);
                        if (he == null) continue;
                        culpPrincipais.add(hh);
                        culpDono.put(he.getDtClass().getDtName() + "/" + getEntityProperty(he, "m_iTeamNum", null), ci);
                    }
                    java.util.Iterator<Integer> culpIt = culpadoClones.iterator();
                    while (culpIt.hasNext()) {
                        Integer ch = culpIt.next();
                        Entity c = culpEnts.getByHandle(ch);
                        if (c == null) { culpIt.remove(); continue; }
                        if (culpPrincipais.contains(ch)) continue;
                        Integer dono = culpDono.get(c.getDtClass().getDtName() + "/" + getEntityProperty(c, "m_iTeamNum", null));
                        Integer cx = getEntityProperty(c, "CBodyComponent.m_cellX", null);
                        Integer cy = getEntityProperty(c, "CBodyComponent.m_cellY", null);
                        Float vx = getEntityProperty(c, "CBodyComponent.m_vecX", null);
                        Float vy = getEntityProperty(c, "CBodyComponent.m_vecY", null);
                        if (dono == null || cx == null || cy == null || vx == null || vy == null) continue;
                        Entry ce = new Entry(time);
                        ce.type = "clone";
                        ce.slot = dono;
                        ce.ehandle = ch;
                        ce.unit = c.getDtClass().getDtName();
                        ce.x = getPreciseLocation(cx, vx);
                        ce.y = getPreciseLocation(cy, vy);
                        ce.life_state = getEntityProperty(c, "m_lifeState", null);
                        ce.key = "w=" + getEntityProperty(c, "m_nWhichMeepo", null)
                                + ";r=" + getEntityProperty(c, "m_hReplicatingOtherHeroModel", null)
                                + ";il=" + getEntityProperty(c, "m_bIsIllusion", null)
                                + ";hp=" + getEntityProperty(c, "m_iHealth", null)
                                + ";mx=" + getEntityProperty(c, "m_iMaxHealth", null);
                        output(ce);
                    }
                } catch (Exception culpEx) {
                    System.err.println("culpado clones: " + culpEx);
                }
""" + INTERVALO


def remendar(raiz: Path) -> bool:
    arq = raiz / "src/main/java/opendota/Parse.java"
    txt = arq.read_text()
    if "culpadoClones" in txt:
        print("parser já tem o remendo dos clones")
        return True
    for ancora in (CAMPO, ENTROU, INTERVALO):
        if txt.count(ancora) != 1:
            print(f"AVISO: âncora do remendo dos clones não achada ({ancora.strip()[:60]!r}); parser sem clones")
            return False
    txt = txt.replace(CAMPO, CAMPO_NOVO).replace(ENTROU, ENTROU_NOVO).replace(INTERVALO, INTERVALO_NOVO)
    arq.write_text(txt)
    print("parser com o remendo dos clones (Meepo, Arc Warden)")
    return True


if __name__ == "__main__":
    remendar(Path(sys.argv[1] if len(sys.argv) > 1 else "parser"))

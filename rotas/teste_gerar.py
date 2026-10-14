"""Testes do robô da base de rotas (sem rede): posições, duelos, formato da base, filtro de partida, acumulado sem
contar duas vezes e "nunca apaga a base boa".

    python3 rotas/teste_gerar.py      (ou: python3 -m unittest rotas/teste_gerar.py)
"""
from __future__ import annotations

import io
import json
import sys

sys.dont_write_bytecode = True  # não deixa __pycache__ na pasta do robô (o workflow faz git add rotas)
import tempfile
import time
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import gerar as G  # noqa: E402


def jog(radiant, hero, lane_role, g10, lh10, roam=False, lane=None, x10=None, lh20=None, wards=None, gpm=0):
    return {"radiant": radiant, "hero": hero, "lane": lane, "lane_role": lane_role, "roam": roam,
            "g10": g10, "x10": x10 if x10 is not None else g10, "lh10": lh10, "lh20": lh20 if lh20 is not None else lh10 * 2,
            "wards": wards, "gpm": gpm}


def partida(roam_es=False):
    # Radiant: AM safe (pos1) + CM (pos5), SF mid, Tide off (pos3) + Earth Spirit (pos4, roamando ou não)
    # Dire:    Axe off (pos3) + Lion (pos4), Storm mid, Slark safe (pos1) + Dazzle (pos5)
    return [
        jog(True, 1, 1, 4200, 50), jog(True, 5, 1, 1900, 5), jog(True, 11, 2, 4300, 45),
        jog(True, 29, 3, 3500, 30), jog(True, 107, 3, 2100, 8, roam=roam_es),
        jog(False, 2, 3, 3300, 25), jog(False, 26, 3, 1800, 4), jog(False, 17, 2, 4000, 40),
        jog(False, 93, 1, 3900, 48), jog(False, 50, 1, 1700, 3),
    ]


def chaves(duelos):
    return {(a, pa, b, pb) for a, pa, b, pb, _, _ in duelos}


class Posicoes(unittest.TestCase):
    def test_core_da_rota_e_quem_tem_mais_last_hits(self):
        js = G.atribuir_posicoes(partida())
        pos = {j["hero"]: (j["pos"], j["rota"]) for j in js}
        self.assertEqual(pos[1], (1, 1))      # AM: safe do Radiant é a lane 1 (baixo)
        self.assertEqual(pos[5], (5, 1))
        self.assertEqual(pos[11], (2, 2))
        self.assertEqual(pos[29], (3, 3))
        self.assertEqual(pos[107], (4, 3))
        self.assertEqual(pos[2], (3, 1))      # Axe: offlane do Dire é a lane 1 (baixo), contra o AM
        self.assertEqual(pos[93], (1, 3))     # Slark: safe do Dire é a lane 3 (cima)

    def test_roamer_sai_da_rota(self):
        js = G.atribuir_posicoes(partida(roam_es=True))
        es = next(j for j in js if j["hero"] == 107)
        self.assertEqual((es["pos"], es["rota"]), (4, None))
        self.assertFalse(any(107 in (d[0], d[2]) for d in G.duelos_da_partida(partida(roam_es=True))))

    def test_suporte_sozinho_na_rota_nao_vira_core(self):
        # Timbersaw sozinho na safe com 0 LH aos 10 min (o carry foi para outro lugar): é suporte, sem duelo de core
        js = partida()
        js[0].update(lane_role=2)  # o AM vai para o mid
        js[1].update(hero=98, lh10=0)
        G.atribuir_posicoes(js)
        timber = next(j for j in js if j["hero"] == 98)
        self.assertEqual((timber["pos"], timber["core"]), (5, False))
        # na safe do Radiant (lane 1) o único duelo é suporte contra suporte (Timbersaw x Lion)
        self.assertIn((98, 5, 26, 4), chaves(G.duelos_da_partida(js)))
        self.assertNotIn((98, 5, 2, 3), chaves(G.duelos_da_partida(js)))

    def test_carry_que_roamou_fica_fora_e_o_suporte_continua_suporte(self):
        js = partida()
        js[0]["roam"] = True  # AM marcado como roamer, mas com 50 LH aos 10 min: core fora da rota
        G.atribuir_posicoes(js)
        am = next(j for j in js if j["hero"] == 1)
        cm = next(j for j in js if j["hero"] == 5)
        self.assertEqual((am["rota"], am["pos"]), (None, None))
        self.assertEqual((cm["pos"], cm["core"]), (5, False))

    def test_farm_parecido_desempata_pelos_last_hits_aos_20(self):
        js = partida()
        js[8].update(lh10=36, lh20=70)                    # Slark
        js[9].update(hero=12, lh10=33, lh20=113, g10=3800)  # PL: menos LH aos 10, bem mais aos 20
        G.atribuir_posicoes(js)
        pl = next(j for j in js if j["hero"] == 12)
        slark = next(j for j in js if j["hero"] == 93)
        self.assertEqual((pl["pos"], pl["principal"], pl["duvida"]), (1, True, True))
        self.assertEqual((slark["pos"], slark["core"]), (5, True))  # dois cores: os dois têm farm de core

    def test_offlaner_apanhando_continua_core_e_suporte_com_estimativa_continua_suporte(self):
        js = partida()
        js[5].update(lh10=18)                 # Axe apanhando: 18 contra 4 do Lion, ainda é o pos3
        js[1].update(lh10=30, est=5)          # CM com 30 LH, mas o OpenDota estima pos5: continua suporte
        js[0].update(lh10=28)
        G.atribuir_posicoes(js)
        por = {j["hero"]: j for j in js}
        self.assertEqual((por[2]["pos"], por[2]["core"]), (3, True))
        self.assertEqual((por[5]["pos"], por[5]["core"], por[5]["duvida"]), (5, False, False))
        self.assertEqual(por[1]["pos"], 1)

    def test_lane_fisica_sem_campo_lane(self):
        self.assertEqual(G.lane_fisica(None, 1, True), 1)
        self.assertEqual(G.lane_fisica(None, 1, False), 3)
        self.assertEqual(G.lane_fisica(None, 3, False), 1)
        self.assertIsNone(G.lane_fisica(None, 4, True))


class Duelos(unittest.TestCase):
    def test_papel_contra_papel_na_mesma_rota(self):
        ds = G.duelos_da_partida(partida())
        k = chaves(ds)
        self.assertIn((1, 1, 2, 3), k)        # AM pos1 x Axe pos3
        self.assertIn((5, 5, 26, 4), k)       # CM pos5 x Lion pos4
        self.assertIn((11, 2, 17, 2), k)      # SF x Storm
        self.assertIn((107, 4, 50, 5), k)     # ES pos4 x Dazzle pos5 (estava na rota)
        self.assertNotIn((1, 1, 26, 4), k)    # nunca core x suporte
        self.assertNotIn((1, 1, 93, 1), k)    # AM e Slark nunca se viram na rota
        self.assertEqual(len(ds), 5)
        am_axe = next(d for d in ds if d[:4] == (1, 1, 2, 3))
        self.assertEqual(am_axe[4], 900)

    def test_mid_dois_contra_um_so_tem_o_duelo_dos_cores(self):
        js = partida()
        js[4].update(lane_role=2)  # Earth Spirit (8 LH) desce para o mid com o SF
        ds = [d for d in G.duelos_da_partida(js) if 11 in (d[0], d[2]) or 107 in (d[0], d[2])]
        self.assertEqual(chaves(ds), {(11, 2, 17, 2)})


class Base(unittest.TestCase):
    def test_formato_so_com_20_ou_mais(self):
        acc = G.nova_acc()
        for _ in range(30):
            G.agregar(G.duelos_da_partida(partida()), acc)
        G.agregar([(7, 1, 8, 3, 500, 0)] * 5, acc)  # par com 5 rotas: não vai para a base
        base = G.montar_base(acc, {"partidas": 30})
        self.assertEqual(base["v"], 2)
        am = base["m"]["1.1"]["2.3"]
        self.assertEqual(am[0], 30)
        self.assertEqual(base["m"]["2.3"]["1.1"][1], -am[1])  # guardado nas duas direções
        self.assertEqual(am[3], 0)  # +900 não é rota "ganha" (limiar 1000)
        self.assertNotIn("7.1", base["m"])
        self.assertIn("1|3", base["p"])
        self.assertEqual(base["p"]["1|3"][1], -base["p"]["3|1"][1])
        self.assertEqual(base["h"]["1.1"]["3"][0], 30)

    def test_amostra_pequena_puxa_para_o_nivel_de_cima_e_nao_para_zero(self):
        acc = G.nova_acc()
        # rota típica pos1 x pos3: +2000 (300 rotas de heróis variados); o par 1.1 x 2.3 tem só 20 rotas, todas +2000
        for h in range(10, 40):
            G.agregar([(h, 1, h + 100, 3, 2000, 0)] * 10, acc)
        G.agregar([(1, 1, 2, 3, 2000, 0)] * 20, acc)
        base = G.montar_base(acc, {})
        self.assertAlmostEqual(base["m"]["1.1"]["2.3"][1], 2000, delta=5)  # antes o robô gravava 2000 * 20/50 = 800

    def test_heroi_forte_aparece_na_frente(self):
        acc, _, _ = G.fonte_falsa(3000)
        base = G.montar_base(acc, {})
        # herói 1 é forte na rota: como pos1 sai bem na frente da rota pos1 x pos3 típica
        self.assertGreater(base["h"]["1.1"]["3"][1] - base["p"]["1|3"][1], 500)
        self.assertLess(len(json.dumps(base, separators=(",", ":"))), 2_000_000)

    def test_espelho_nao_vai_para_os_pares(self):
        acc = G.nova_acc()
        G.agregar([(14, 2, 14, 2, 300, 0)] * 25, acc)
        base = G.montar_base(acc, {})
        self.assertNotIn("14.2", base["m"])
        self.assertEqual(base["p"]["2|2"][1], 0)

    def test_linhas_do_explorer(self):
        rows = [{"match_id": 9, "player_slot": s, "hero_id": h, "lane": None, "lane_role": lr, "is_roaming": False,
                 "gold_per_min": 400, "g10": g, "x10": g, "lh10": lh, "lh20": lh * 2, "start_time": 1000}
                for s, h, lr, g, lh in [(0, 1, 1, 4200, 50), (1, 5, 1, 1900, 5), (2, 11, 2, 4300, 45), (3, 29, 3, 3500, 30), (4, 107, 3, 2100, 8),
                                        (128, 2, 3, 3300, 25), (129, 26, 3, 1800, 4), (130, 17, 2, 4000, 40), (131, 93, 1, 3900, 48), (132, 50, 1, 1700, 3)]]
        rows.append({**rows[0], "match_id": 10})  # partida cortada pelo LIMIT: fica de fora
        js = G.partidas_das_linhas(rows)
        self.assertEqual(len(js), 1)
        self.assertEqual(len(G.duelos_da_partida(js[0][1])), 5)
        self.assertEqual(js[0][2], 1000)


class Filtro(unittest.TestCase):
    def _partida(self, **kw):
        ps = [{"hero_id": i + 1, "player_slot": i if i < 5 else 123 + i, "leaver_status": 0, "rank_tier": 52} for i in range(10)]
        m = {"version": 21, "game_mode": 22, "duration": 2400, "players": ps}
        m.update(kw)
        return m

    def test_turbo_abandono_curta_e_rank_alto_ficam_fora(self):
        self.assertIsNone(G.valida(self._partida()))
        self.assertEqual(G.valida(self._partida(game_mode=23)), "modo 23")
        self.assertEqual(G.valida(self._partida(duration=600)), "menos de 15 min")
        m = self._partida()
        m["players"][3]["leaver_status"] = 2
        self.assertEqual(G.valida(m), "abandono")
        m = self._partida()
        for p in m["players"]:
            p["rank_tier"] = 80
        self.assertEqual(G.valida(m), "rank alto")

    def test_amostra_descarta_turbo_e_para_no_que_ja_coletou(self):
        boa = {"version": 21, "game_mode": 22, "duration": 2400, "players": [
            {"player_slot": s, "hero_id": h, "lane_role": lr, "gold_t": [0] * 10 + [g] + [g] * 12, "xp_t": [0] * 10 + [g] + [g] * 12,
             "lh_t": [0] * 10 + [lh] + [lh] * 12, "gold_per_min": 400, "leaver_status": 0}
            for s, h, lr, g, lh in [(0, 1, 1, 4200, 50), (1, 5, 1, 1900, 5), (2, 11, 2, 4300, 45), (3, 29, 3, 3500, 30), (4, 107, 3, 2100, 8),
                                    (128, 2, 3, 3300, 25), (129, 26, 3, 1800, 4), (130, 17, 2, 4000, 40), (131, 93, 1, 3900, 48), (132, 50, 1, 1700, 3)]]}
        turbo = {**boa, "game_mode": 23}

        def falso(url, **_):
            if "parsedMatches" in url:
                return [{"match_id": i} for i in (105, 104, 103, 102, 101)]
            mid = int(url.rsplit("/", 1)[1])
            return turbo if mid == 104 else boa
        with mock.patch.object(G, "get_json", side_effect=falso):
            acc, n, estado = G.fonte_amostra(time.time() + 60, 1000, ate_match_id=102)
        self.assertEqual(n, 2)  # 105 e 103 (104 é Turbo; 102 e 101 já foram coletadas)
        self.assertEqual(estado["ate_match_id"], 105)
        self.assertEqual(acc["1.1|2.3"][0], 2)


class Http(unittest.TestCase):
    def test_erro_de_sql_do_explorer_volta_com_o_motivo(self):
        erro = urllib.error.HTTPError("u", 400, "Bad Request", {}, io.BytesIO(b'{"err": "column pm.is_roaming does not exist"}'))
        with mock.patch.object(G.urllib.request, "urlopen", side_effect=erro), mock.patch.object(G.time, "sleep"):
            d = G.get_json("https://api.opendota.com/api/explorer?sql=x")
        self.assertIn("is_roaming", d["err"])

    def test_outro_400_mostra_o_corpo(self):
        erro = urllib.error.HTTPError("u", 400, "Bad Request", {}, io.BytesIO(b"query invalida"))
        with mock.patch.object(G.urllib.request, "urlopen", side_effect=erro), mock.patch.object(G.time, "sleep"):
            with self.assertRaisesRegex(RuntimeError, "query invalida"):
                G.get_json("https://api.opendota.com/api/explorer?sql=x")


class Acumulado(unittest.TestCase):
    def test_decaimento_pelo_tempo_e_poda(self):
        acc = G.nova_acc()
        G.agregar([(1, 1, 2, 3, 1000, 0)], acc)
        fator = G.fator_de_decaimento(time.time() - 14 * 86400, time.time())
        self.assertAlmostEqual(fator, G.DECAIMENTO_SEMANA ** 2, places=3)
        G.juntar(acc, {"pares": {"1.1|2.3": [10, 0, 0, 0, 0], "7.1|8.3": [0.4, 0, 0, 0, 0]}}, fator)
        self.assertAlmostEqual(acc["1.1|2.3"][0], 1 + 10 * fator)
        self.assertNotIn("7.1|8.3", acc)

    def test_rodada_repetida_nao_soma_de_novo(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            chamadas = []

            def amostra(prazo, orcamento, ate_match_id=0, rank_max=G.RANK_MAX):
                chamadas.append(ate_match_id)
                acc = G.nova_acc()
                if ate_match_id < 500:  # só há partidas novas na primeira rodada
                    for _ in range(150):
                        G.agregar(G.duelos_da_partida(partida()), acc)
                    return acc, 150, {"ate_match_id": 500}
                return acc, 0, {"ate_match_id": ate_match_id}
            with mock.patch.object(G, "fonte_amostra", side_effect=amostra):
                args = ["--fonte", "amostra", "--saida", str(d / "base.json"), "--acumulado", str(d / "acc.json")]
                self.assertEqual(G.main(args), 0)
                self.assertEqual(G.main(args), 1)  # nada de novo: não grava
            self.assertEqual(chamadas, [0, 500])
            acc = json.loads((d / "acc.json").read_text())
            self.assertEqual(acc["pares"]["1.1|2.3"][0], 150)
            self.assertEqual(acc["ate_match_id"], 500)


class NuncaApagaABoa(unittest.TestCase):
    def _rodar(self, d, *args):
        return G.main(["--saida", str(d / "base.json"), "--acumulado", str(d / "acc.json"), *args])

    def test_falso_grava_fora_de_rotas(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            self.assertEqual(self._rodar(d, "--fonte", "falso"), 0)
            base = json.loads((d / "base.json").read_text())
            self.assertEqual((base["v"], base["minuto"]), (2, 10))
            self.assertTrue(base["m"] and base["h"] and base["p"])

    def test_falso_nunca_grava_em_rotas(self):
        self.assertEqual(G.main(["--fonte", "falso"]), 2)
        self.assertEqual(G.main(["--fonte", "falso", "--saida", str(G.AQUI / "base.json"), "--acumulado", "/tmp/x.json"]), 2)

    def test_coleta_falha_mantem_base(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            (d / "base.json").write_text('{"boa": true}')
            with mock.patch.object(G, "get_json", side_effect=RuntimeError("sem rede")), mock.patch.object(G.time, "sleep"):
                self.assertEqual(self._rodar(d), 1)
            self.assertEqual(json.loads((d / "base.json").read_text()), {"boa": True})

    def test_amostra_pequena_mantem_base(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            (d / "base.json").write_text('{"boa": true}')
            with mock.patch.object(G, "contagem_do_explorer", side_effect=RuntimeError("x")), \
                    mock.patch.object(G, "fonte_amostra", return_value=(G.nova_acc(), 50, {})):
                self.assertEqual(self._rodar(d), 1)
            self.assertEqual(json.loads((d / "base.json").read_text()), {"boa": True})
            self.assertFalse((d / "acc.json").exists())

    def test_auto_usa_a_amostra_quando_o_explorer_e_so_de_liga(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            acc, _, _ = G.fonte_falsa(300)
            with mock.patch.object(G, "contagem_do_explorer", return_value={"total": 300, "liga": 300, "publicas": 0}), \
                    mock.patch.object(G, "fonte_explorer") as explorer, \
                    mock.patch.object(G, "fonte_amostra", return_value=(acc, 300, {"ate_match_id": 9})) as amostra:
                self.assertEqual(self._rodar(d, "--prazo-min", "30"), 0)
            explorer.assert_not_called()
            prazo = amostra.call_args[0][0]
            self.assertLess(prazo - time.time(), 30 * 60 + 5)  # a amostra recebe o prazo da rodada inteira
            self.assertEqual(json.loads((d / "base.json").read_text())["fonte"], "amostra")

    def test_explorer_com_erro_cai_para_amostra(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            acc, _, _ = G.fonte_falsa(300)
            with mock.patch.object(G, "contagem_do_explorer", return_value={"total": 900, "liga": 10, "publicas": 890}), \
                    mock.patch.object(G, "fonte_explorer", side_effect=RuntimeError("timeout")), \
                    mock.patch.object(G, "fonte_amostra", return_value=(acc, 300, {})) as amostra:
                self.assertEqual(self._rodar(d), 0)
            amostra.assert_called_once()
            self.assertEqual(json.loads((d / "base.json").read_text())["fonte"], "amostra")

    def test_explorer_desiste_depois_de_3_fatias_com_erro(self):
        with mock.patch.object(G, "get_json", side_effect=RuntimeError("HTTP 524")) as gj:
            with self.assertRaises(RuntimeError):
                G.fonte_explorer(14, 14, 30000, time.time() + 600)
        self.assertEqual(gj.call_count, 3)


if __name__ == "__main__":
    unittest.main()

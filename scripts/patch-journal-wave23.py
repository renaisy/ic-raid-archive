#!/usr/bin/env python3
"""Add positions + ability scenes for wave 2–3 bosses. Does not invent mechanics."""
import json
from pathlib import Path

PATH = Path("/home/ubuntu/ic-raid-archive/data/raid-journal.json")


def sc(arena, loop, actors):
    return {"arena": arena, "loopMs": loop, "actors": actors}


def pos(title, caption, arena, loop, actors, diffs=None):
    row = {"title": title, "caption": caption, "scene": sc(arena, loop, actors)}
    if diffs:
        row["diffs"] = diffs
    return row


def ab(name_zh, name_en, tag, text, **extra):
    row = {"nameZh": name_zh, "nameEn": name_en, "tag": tag, "text": text}
    row.update(extra)
    return row


VASHNIK = {
    "wipefestSlug": "vashnik-the-malignant",
    "positions": [
        pos(
            "三泉开场",
            "场中裂隙。坦在将喝的两口泉中间报出来。团在王身后，别挡活毒截击线。",
            "circle",
            3600,
            [
                {"id": "rift", "type": "hazard", "x": 50, "y": 36, "r": 7, "label": "裂隙", "pulse": True},
                {"id": "blood", "type": "mark", "x": 26, "y": 28, "label": "血"},
                {"id": "shadow", "type": "mark", "x": 50, "y": 16, "label": "暗"},
                {"id": "fire", "type": "mark", "x": 74, "y": 28, "label": "火"},
                {"id": "boss", "type": "boss", "x": 38, "y": 22, "label": "王"},
                {"id": "tank", "type": "tank", "x": 38, "y": 30, "label": "两泉中"},
                {"id": "raid", "type": "melee", "x": 50, "y": 52, "label": "团"},
            ],
        ),
        pos(
            "截活毒",
            "活毒出生就拦，别让它走进裂隙。火的错开斩；血的死了收小块。",
            "circle",
            3400,
            [
                {"id": "rift", "type": "hazard", "x": 50, "y": 36, "r": 7, "label": "裂隙", "pulse": True},
                {"id": "add", "type": "add", "label": "活毒", "path": [[26, 24], [36, 28], [46, 34]]},
                {"id": "stop", "type": "soak", "x": 40, "y": 30, "r": 6, "pulse": True, "label": "先杀"},
                {"id": "melee", "type": "melee", "x": 38, "y": 34, "label": "截"},
                {"id": "boss", "type": "boss", "x": 62, "y": 48, "label": "王"},
            ],
        ),
    ],
    "abilities": [
        ab(
            "畅饮",
            "Imbibe",
            "灭团",
            "能量满，喝最近两口泉：上毒雾，并出活毒朝裂隙走。",
            scene=sc(
                "circle",
                3800,
                [
                    {"id": "a", "type": "mark", "x": 28, "y": 24, "label": "泉"},
                    {"id": "b", "type": "mark", "x": 50, "y": 14, "label": "泉"},
                    {"id": "rift", "type": "hazard", "x": 50, "y": 40, "r": 7, "label": "裂隙"},
                    {"id": "boss", "type": "boss", "x": 38, "y": 20, "label": "喝"},
                    {"id": "add", "type": "add", "label": "活毒", "path": [[36, 22], [42, 30], [48, 38]]},
                ],
            ),
        ),
        ab("毒雾", "Toxic Vapor", "治疗", "全团自然跳伤。每喝一口叠一层，越打越疼。软狂暴。"),
        ab(
            "恶毒爆发",
            "Malignant Burst",
            "重要",
            "活毒进裂隙：立刻一下再跳 30 秒，叠层。别让它到。",
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "rift", "type": "hazard", "x": 50, "y": 36, "r": 9, "label": "裂隙", "pulse": True},
                    {"id": "add", "type": "add", "label": "活毒", "path": [[24, 20], [36, 28], [50, 36]]},
                    {"id": "bad", "type": "mark", "x": 50, "y": 36, "label": "别进"},
                ],
            ),
        ),
        ab(
            "鲜血灌注",
            "Blood Infusion",
            "重要",
            "喝泉后带上该泉元素（血/暗/火），强化下一轮畅饮、喷发和活毒血量。",
            scene=sc(
                "circle",
                4200,
                [
                    {"id": "blood", "type": "mark", "x": 26, "y": 30, "label": "血"},
                    {"id": "shadow", "type": "mark", "x": 50, "y": 16, "label": "暗"},
                    {"id": "fire", "type": "mark", "x": 74, "y": 30, "label": "火"},
                    {"id": "tank", "type": "tank", "label": "换两口", "path": [[38, 24], [62, 24], [62, 36], [38, 36]]},
                    {"id": "boss", "type": "boss", "x": 50, "y": 48, "label": "王"},
                ],
            ),
        ),
        ab(
            "分裂凝血",
            "Splitting Clot",
            "重要",
            "血活毒免疫控。杀掉裂成两条小的，收干净。",
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "big", "type": "add", "x": 42, "y": 36, "label": "血毒"},
                    {"id": "s1", "type": "add", "label": "小", "path": [[42, 36], [28, 28]]},
                    {"id": "s2", "type": "add", "label": "小", "path": [[42, 36], [56, 48]]},
                    {"id": "melee", "type": "melee", "x": 50, "y": 36, "label": "收干净"},
                ],
            ),
        ),
        ab(
            "适应感染",
            "Adaptive Infection",
            "治疗",
            "按当前泉出三种：血=圈里吸血；暗=散开；火=驱散炸全团。",
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "soak", "type": "soak", "x": 28, "y": 36, "r": 7, "pulse": True, "label": "血圈"},
                    {"id": "spread", "type": "ranged", "x": 50, "y": 20, "label": "暗散"},
                    {"id": "fire", "type": "healer", "x": 72, "y": 36, "label": "火错开驱"},
                    {"id": "boss", "type": "boss", "x": 50, "y": 50, "label": "王"},
                ],
            ),
        ),
        ab("滴毒尖牙", "Dripping Fangs", "坦克", "物理易伤 100%，32 秒。每下换坦。"),
        ab(
            "恶毒触媒",
            "Malignant Catalyst",
            "重要",
            "胆汁落点附近要有人。没人接，全团挨更大一下。",
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "c1", "type": "soak", "x": 32, "y": 28, "r": 6, "pulse": True, "label": "踩"},
                    {"id": "c2", "type": "soak", "x": 50, "y": 50, "r": 6, "pulse": True, "label": "踩"},
                    {"id": "c3", "type": "soak", "x": 70, "y": 30, "r": 6, "pulse": True, "label": "踩"},
                    {"id": "p1", "type": "ranged", "x": 32, "y": 28},
                    {"id": "p2", "type": "healer", "x": 50, "y": 50},
                    {"id": "p3", "type": "melee", "x": 70, "y": 30},
                ],
            ),
        ),
        ab(
            "瘟疫泡沫",
            "Plague Froth",
            "重要",
            "点名散开。结束喷十字波，躲开轴线。",
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "王"},
                    {"id": "a", "type": "ranged", "x": 28, "y": 22, "label": "散"},
                    {"id": "b", "type": "healer", "x": 74, "y": 50, "label": "散"},
                    {"id": "h", "type": "proj", "label": "横", "path": [[18, 36], [82, 36]]},
                    {"id": "v", "type": "proj", "label": "竖", "path": [[50, 10], [50, 62]]},
                ],
            ),
        ),
    ],
}

SSZORAK = {
    "wipefestSlug": "sszorak",
    "positions": [
        pos(
            "开场两组",
            "两组各至少 5 人。风口对面放标记，毒涌囊肿丢在将吹风的对面。",
            "circle",
            3600,
            [
                {"id": "boss", "type": "boss", "x": 50, "y": 48, "label": "王"},
                {"id": "g1", "type": "soak", "x": 30, "y": 40, "r": 8, "label": "1组"},
                {"id": "g2", "type": "soak", "x": 70, "y": 40, "r": 8, "label": "2组"},
                {"id": "vent", "type": "mark", "x": 50, "y": 14, "label": "风口"},
                {"id": "cyst", "type": "drop", "x": 50, "y": 58, "r": 5, "label": "囊肿对面"},
            ],
        ),
        pos(
            "过渡叠中",
            "场中重叠。风把自己推进预放的囊肿，囊肿弹回王。钻地 25 秒打满。",
            "circle",
            3800,
            [
                {"id": "vent", "type": "mark", "x": 50, "y": 12, "label": "风"},
                {"id": "wind", "type": "proj", "label": "吹", "path": [[50, 14], [50, 36], [50, 52]]},
                {"id": "raid", "type": "melee", "x": 50, "y": 36, "label": "叠中"},
                {"id": "cyst", "type": "drop", "x": 50, "y": 56, "r": 6, "label": "囊肿", "pulse": True},
                {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "钻地"},
            ],
        ),
    ],
    "abilities": [
        ab(
            "顶级猎手",
            "Apex Predator",
            "坦克",
            "5 连随机。撕裂是坦锥，换坦；残害是团锥，两组≥5 人轮流；飓风躲开。",
            scene=sc(
                "circle",
                3600,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 40, "label": "王"},
                    {"id": "tank", "type": "tank", "x": 50, "y": 58, "label": "撕裂靠边"},
                    {"id": "g1", "type": "soak", "x": 28, "y": 32, "r": 7, "label": "1组"},
                    {"id": "g2", "type": "soak", "x": 72, "y": 32, "r": 7, "label": "2组"},
                    {"id": "wind", "type": "proj", "label": "飓", "path": [[20, 20], [80, 52]]},
                ],
            ),
        ),
        ab(
            "残害",
            "Mutilate",
            "重要",
            "不足 5 人秒人。吃过的人下次残害受伤提高 500%，必须换组。",
            diffs=["heroic", "mythic"],
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "王"},
                    {"id": "now", "type": "soak", "x": 30, "y": 42, "r": 8, "pulse": True, "label": "这组"},
                    {"id": "next", "type": "soak", "x": 70, "y": 42, "r": 8, "label": "下组"},
                    {"id": "swap", "type": "ranged", "label": "换组", "path": [[30, 42], [70, 42]]},
                ],
            ),
        ),
        ab(
            "残害分摊",
            "Mutilate soak",
            "重要",
            "两组各至少 5 人轮流接锥形。同组别连吃。",
            methodText="Mutilate",
            icyText="Mutilate",
            diffs=["normal"],
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "王"},
                    {"id": "g1", "type": "soak", "x": 30, "y": 42, "r": 8, "label": "1组"},
                    {"id": "g2", "type": "soak", "x": 70, "y": 42, "r": 8, "label": "2组"},
                ],
            ),
        ),
        ab("腐蚀毒液", "Corroding Venom", "坦克", "每下普攻提高受到的物理伤害。叠层换坦。"),
        ab(
            "毒涌",
            "Venomous Surge",
            "治疗",
            "几个人身上喷毒，结束爆炸并留黏液囊肿。散开，囊肿对着风口对面丢。",
            scene=sc(
                "circle",
                3600,
                [
                    {"id": "vent", "type": "mark", "x": 50, "y": 14, "label": "风口"},
                    {"id": "p1", "type": "ranged", "label": "丢对面", "path": [[36, 30], [50, 56]]},
                    {"id": "p2", "type": "healer", "label": "丢对面", "path": [[64, 30], [56, 58]]},
                    {"id": "c1", "type": "drop", "x": 48, "y": 56, "r": 5, "label": "囊肿"},
                    {"id": "c2", "type": "drop", "x": 58, "y": 58, "r": 4},
                    {"id": "boss", "type": "boss", "x": 50, "y": 40, "label": "王"},
                ],
            ),
        ),
        ab(
            "狂暴侧风",
            "Raging Crosswinds",
            "重要",
            "箭头互指，空中圈碰到就落地。没对上会往台边飘。",
            scene=sc(
                "circle",
                2800,
                [
                    {"id": "a", "type": "ranged", "label": "对撞", "path": [[24, 28], [46, 36]]},
                    {"id": "b", "type": "healer", "label": "对撞", "path": [[76, 44], [54, 36]]},
                    {"id": "ok", "type": "soak", "x": 50, "y": 36, "r": 6, "pulse": True, "label": "碰上落地"},
                    {"id": "edge", "type": "mark", "x": 84, "y": 56, "label": "别出台"},
                ],
            ),
        ),
        ab(
            "呼啸漩涡",
            "Howling Maelstrom",
            "重要",
            "祭坛连吹几道飓风。叠中间，让风把自己推进预放的囊肿。",
            scene=sc(
                "circle",
                3600,
                [
                    {"id": "wind", "type": "proj", "label": "风", "path": [[50, 12], [50, 36], [50, 54]]},
                    {"id": "raid", "type": "melee", "x": 50, "y": 36, "label": "叠中"},
                    {"id": "cyst", "type": "drop", "x": 50, "y": 56, "r": 6, "label": "弹回", "pulse": True},
                ],
            ),
        ),
        ab(
            "钻地",
            "Dig In",
            "重要",
            "漩涡期间王钻地，25 秒受伤提高 30%。爆发窗。",
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "钻地", "pulse": True},
                    {"id": "dps", "type": "melee", "x": 42, "y": 44, "label": "爆发"},
                    {"id": "rdps", "type": "ranged", "x": 62, "y": 28, "label": "打满"},
                    {"id": "buff", "type": "mark", "x": 50, "y": 20, "label": "30%"},
                ],
            ),
        ),
        ab("乌拉泰克之息", "Ula'tek's Presence", "治疗", "祭坛酸雾，全团持续自然伤。"),
    ],
}

TWINFANGS = {
    "wipefestSlug": "the-twin-fangs",
    "positions": [
        pos(
            "两蛇就地",
            "两蛇不共血、不能挪。维克斯胡尔看倾泻，碎石者两组坦轮流接。必须齐斩。",
            "circle",
            3600,
            [
                {"id": "vix", "type": "boss", "x": 28, "y": 36, "label": "维克斯"},
                {"id": "shat", "type": "boss", "x": 72, "y": 36, "label": "碎石"},
                {"id": "t1", "type": "tank", "x": 28, "y": 50, "label": "倾泻坦"},
                {"id": "t2", "type": "tank", "x": 72, "y": 50, "label": "碎石坦"},
                {"id": "m1", "type": "melee", "x": 36, "y": 28, "label": "近"},
                {"id": "m2", "type": "melee", "x": 64, "y": 28, "label": "近"},
            ],
        ),
        pos(
            "盛宴三组",
            "贪食盛宴三下。每组只吃 1 下。低层去踩腐蚀团，高层去吃盛宴。",
            "circle",
            3200,
            [
                {"id": "vix", "type": "boss", "x": 50, "y": 28, "label": "王"},
                {"id": "s1", "type": "soak", "x": 30, "y": 48, "r": 7, "pulse": True, "label": "1组"},
                {"id": "s2", "type": "soak", "x": 50, "y": 56, "r": 7, "label": "2组"},
                {"id": "s3", "type": "soak", "x": 70, "y": 48, "r": 7, "label": "3组"},
            ],
        ),
    ],
    "abilities": [
        ab("永恒毒液", "Eternal Venom", "灭团", "绿色技能叠自然跳伤，永不掉。10 层即死。只有贪食盛宴能减 1 层。"),
        ab(
            "腐蚀倾泻",
            "Caustic Deluge",
            "坦克",
            "维克斯胡尔对当前目标引导并外喷，落点留腐蚀团。团员别站坦旁边。",
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "boss", "type": "boss", "x": 32, "y": 36, "label": "维克斯"},
                    {"id": "tank", "type": "tank", "label": "拉开", "path": [[32, 50], [22, 58]]},
                    {"id": "glob", "type": "drop", "x": 22, "y": 58, "r": 5, "label": "团"},
                    {"id": "raid", "type": "melee", "x": 50, "y": 30, "label": "别站旁边"},
                ],
            ),
        ),
        ab(
            "腐蚀团",
            "Caustic Globule",
            "重要",
            "一人踩一个。没人踩，10 秒后全团叠一层永恒毒液。",
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "g1", "type": "drop", "x": 28, "y": 28, "r": 4, "label": "团"},
                    {"id": "g2", "type": "drop", "x": 50, "y": 52, "r": 4, "label": "团"},
                    {"id": "g3", "type": "drop", "x": 74, "y": 30, "r": 4, "label": "团"},
                    {"id": "p1", "type": "ranged", "x": 28, "y": 28, "label": "踩"},
                    {"id": "p2", "type": "healer", "x": 50, "y": 52, "label": "踩"},
                    {"id": "p3", "type": "melee", "x": 74, "y": 30, "label": "踩"},
                ],
            ),
        ),
        ab(
            "毒裔现身",
            "Venomous Emergence",
            "重要",
            "不可避免地给全团叠一层，并出三只小蛇。清掉，躲开唾液线。",
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "a1", "type": "add", "x": 30, "y": 24, "label": "裔"},
                    {"id": "a2", "type": "add", "x": 50, "y": 54, "label": "裔"},
                    {"id": "a3", "type": "add", "x": 72, "y": 28, "label": "裔"},
                    {"id": "line", "type": "proj", "label": "唾液", "path": [[30, 24], [72, 28]]},
                    {"id": "melee", "type": "melee", "x": 50, "y": 36, "label": "先清"},
                ],
            ),
        ),
        ab(
            "贪食盛宴",
            "Ravenous Feast",
            "重要",
            "连吞三次。每次给被打到的人减 1 层，并上 800% 易伤。三组轮流，或两组加免疫吃第三下。",
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 26, "label": "吞"},
                    {"id": "s1", "type": "soak", "x": 30, "y": 48, "r": 7, "pulse": True, "label": "1"},
                    {"id": "s2", "type": "soak", "x": 50, "y": 56, "r": 7, "label": "2"},
                    {"id": "s3", "type": "soak", "x": 70, "y": 48, "r": 7, "label": "3"},
                    {"id": "done", "type": "ranged", "label": "吃过走开", "path": [[30, 48], [18, 22]]},
                ],
            ),
        ),
        ab("碎石者", "Stone Breaker", "坦克", "吼开再连砸。砸到的人后续更疼。没人接，全团挨。两组坦轮流。"),
        ab(
            "秽毒洪流",
            "Vile Flood",
            "重要",
            "潜水时维克斯胡尔正面喷毒流。逆着球转穿过去，后面安全。",
            scene=sc(
                "circle",
                3800,
                [
                    {"id": "boss", "type": "boss", "x": 36, "y": 36, "label": "维克斯"},
                    {"id": "flood", "type": "drop", "label": "洪流", "path": [[50, 16], [72, 28], [74, 50], [50, 60], [28, 50]], "r": 6},
                    {"id": "cut", "type": "melee", "label": "逆穿", "path": [[62, 44], [48, 36], [36, 28]]},
                    {"id": "safe", "type": "healer", "x": 24, "y": 20, "label": "后面安全"},
                ],
            ),
        ),
        ab(
            "解缠之怒",
            "Uncoiled Wrath",
            "灭团",
            "一只先死，活着的那只每 4 秒伤害提高 25%。必须齐斩。",
            scene=sc(
                "circle",
                2800,
                [
                    {"id": "dead", "type": "mark", "x": 28, "y": 36, "label": "先死"},
                    {"id": "live", "type": "boss", "x": 68, "y": 36, "label": "狂怒", "pulse": True},
                    {"id": "raid", "type": "melee", "x": 50, "y": 50, "label": "齐斩"},
                ],
            ),
        ),
    ],
}

ALTAR = {
    "wipefestSlug": "the-coiled-altar",
    "positions": [
        pos(
            "一阶段收球",
            "中场松散叠。凝血球收到指定点，坦用斩裂扫掉。英雄别一次清太多。",
            "circle",
            3600,
            [
                {"id": "boss", "type": "boss", "x": 50, "y": 40, "label": "祖尔詹"},
                {"id": "raid", "type": "melee", "x": 50, "y": 50, "label": "松散叠"},
                {"id": "b1", "type": "drop", "label": "球", "path": [[28, 22], [64, 28]]},
                {"id": "b2", "type": "drop", "label": "球", "path": [[36, 56], [64, 30]]},
                {"id": "pile", "type": "mark", "x": 66, "y": 28, "label": "收这里"},
                {"id": "tank", "type": "tank", "x": 62, "y": 36, "label": "斩裂"},
            ],
        ),
        pos(
            "二阶段行军",
            "偏一侧叠，控恐惧行军方向。破盾后把鬼带到中间面对定住，斩魂清。",
            "circle",
            3800,
            [
                {"id": "boss", "type": "boss", "x": 38, "y": 40, "label": "玛拉卡斯"},
                {"id": "raid", "type": "melee", "x": 32, "y": 50, "label": "偏一侧"},
                {"id": "march", "type": "ranged", "label": "行军", "path": [[40, 36], [62, 28], [80, 20]]},
                {"id": "edge", "type": "mark", "x": 84, "y": 16, "label": "台边"},
                {"id": "ghost", "type": "add", "label": "鬼", "path": [[70, 24], [50, 36]]},
                {"id": "tank", "type": "tank", "x": 50, "y": 36, "label": "斩魂"},
            ],
        ),
        pos(
            "束缚拦碎裂",
            "祖尔詹受伤提高 100%，嗜血在这里。围着他错开拦碎裂体，别同时踩。",
            "circle",
            3400,
            [
                {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "祖尔詹", "pulse": True},
                {"id": "s1", "type": "soak", "x": 34, "y": 28, "r": 6, "pulse": True, "label": "先拦"},
                {"id": "s2", "type": "soak", "x": 66, "y": 28, "r": 6, "label": "再拦"},
                {"id": "s3", "type": "soak", "x": 50, "y": 54, "r": 6, "label": "后拦"},
                {"id": "raid", "type": "melee", "x": 50, "y": 44, "label": "嗜血斩"},
            ],
            diffs=["heroic", "mythic"],
        ),
    ],
    "abilities": [
        ab(
            "毒液倾盆",
            "Toxic Deluge",
            "重要",
            "绿圈落地成凝血球。收到指定点，用斩裂清。英雄：同时清太多会叠跳伤。",
            normalText="绿圈落地成凝血球。收到指定点，用斩裂清。",
            scene=sc(
                "circle",
                3600,
                [
                    {"id": "b1", "type": "drop", "label": "球", "path": [[24, 24], [68, 30]]},
                    {"id": "b2", "type": "drop", "label": "球", "path": [[40, 58], [68, 32]]},
                    {"id": "pile", "type": "mark", "x": 70, "y": 30, "label": "收点"},
                    {"id": "boss", "type": "boss", "x": 46, "y": 40, "label": "王"},
                ],
            ),
        ),
        ab(
            "斩裂",
            "Sever",
            "坦克",
            "祖尔詹正面锥形重砍，再吃受伤提高。锥形能清凝血球。每下换坦。",
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "boss", "type": "boss", "x": 44, "y": 40, "label": "祖尔詹"},
                    {"id": "cone", "type": "soak", "x": 64, "y": 32, "r": 9, "pulse": True, "label": "锥"},
                    {"id": "ball", "type": "drop", "x": 66, "y": 30, "r": 4, "label": "球"},
                    {"id": "tank", "type": "tank", "x": 62, "y": 38, "label": "换坦"},
                ],
            ),
        ),
        ab(
            "断头台",
            "Guillotine",
            "重要",
            "至少 5 人分摊。英雄：吃过的人下次受伤提高 500%，必须换组。寡妇之吻后离开。",
            normalText="至少 5 人分摊。寡妇之吻后离开。",
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 30, "label": "王"},
                    {"id": "g1", "type": "soak", "x": 32, "y": 48, "r": 8, "pulse": True, "label": "1组"},
                    {"id": "g2", "type": "soak", "x": 68, "y": 48, "r": 8, "label": "2组"},
                    {"id": "leave", "type": "ranged", "label": "吻后离开", "path": [[32, 48], [18, 22]]},
                ],
            ),
        ),
        ab("盘绕祭坛之牙", "Fangs of the Coiled Altar", "治疗", "祖尔詹抽祭坛，全团伤，同时铺开枯萎地。"),
        ab(
            "恐惧行军",
            "Dreadmarch",
            "重要",
            "控几个人上吸收盾，逼他们走向台边。盾破了出恐惧造物。",
            scene=sc(
                "circle",
                3800,
                [
                    {"id": "boss", "type": "boss", "x": 36, "y": 40, "label": "王"},
                    {"id": "m1", "type": "ranged", "label": "行军", "path": [[42, 36], [68, 24], [82, 16]]},
                    {"id": "break", "type": "melee", "x": 50, "y": 36, "label": "破盾"},
                    {"id": "edge", "type": "mark", "x": 86, "y": 14, "label": "台边"},
                ],
            ),
        ),
        ab(
            "斩魂",
            "Soul Sever",
            "坦克",
            "玛拉卡斯正面锥形。打到的恐惧造物会被清掉；被打到的人要捡 3 个魂片。",
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "boss", "type": "boss", "x": 40, "y": 40, "label": "玛拉卡斯"},
                    {"id": "cone", "type": "soak", "x": 58, "y": 36, "r": 8, "pulse": True, "label": "锥"},
                    {"id": "ghost", "type": "add", "x": 60, "y": 34, "label": "鬼"},
                    {"id": "orb", "type": "mark", "x": 68, "y": 48, "label": "魂片"},
                    {"id": "tank", "type": "tank", "x": 56, "y": 44, "label": "捡3"},
                ],
            ),
        ),
        ab("永夜降临", "Eternal Nightfall", "灭团", "先套暮光帷幕再读毁灭一击。帷幕打碎才能打断。"),
        ab(
            "灵魂尖笑",
            "Spiritcackle",
            "重要",
            "英雄出小怪，反复读恐惧哀嚎。指定人打断并杀掉。",
            diffs=["heroic", "mythic"],
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "add", "type": "add", "x": 68, "y": 28, "label": "尖笑", "pulse": True},
                    {"id": "kick", "type": "ranged", "x": 62, "y": 36, "label": "打断"},
                    {"id": "boss", "type": "boss", "x": 40, "y": 42, "label": "王"},
                ],
            ),
        ),
        ab(
            "灵魂束缚",
            "Soulbinding",
            "重要",
            "玛拉卡斯倒地后绑祖尔詹。祖尔詹受伤提高 100%。碎裂体要拦，读完会拉傀儡。",
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "100%", "pulse": True},
                    {"id": "s1", "type": "soak", "x": 34, "y": 26, "r": 6, "pulse": True, "label": "拦"},
                    {"id": "s2", "type": "soak", "x": 66, "y": 26, "r": 6, "label": "错开"},
                    {"id": "raid", "type": "melee", "x": 50, "y": 48, "label": "嗜血"},
                ],
            ),
        ),
    ],
}

ULATEK = {
    "wipefestSlug": "ulatek",
    "positions": [
        pos(
            "波让蛋",
            "腐蚀波扫过蛋会立刻孵蛇。让开蛋，别把波带过去。子嗣尽快清。",
            "circle",
            3600,
            [
                {"id": "e1", "type": "mark", "x": 22, "y": 24, "label": "蛋"},
                {"id": "e2", "type": "mark", "x": 78, "y": 24, "label": "蛋"},
                {"id": "e3", "type": "mark", "x": 22, "y": 50, "label": "蛋"},
                {"id": "wave", "type": "proj", "label": "波", "path": [[18, 36], [82, 36]]},
                {"id": "raid", "type": "melee", "x": 50, "y": 48, "label": "让开蛋"},
                {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "王"},
            ],
        ),
        pos(
            "围猎中距",
            "拆一块台，逼人靠拢。贴太近击退，13 码外也疼。保持中距。",
            "circle",
            3400,
            [
                {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "王"},
                {"id": "near", "type": "hazard", "x": 50, "y": 36, "r": 8, "label": "太近"},
                {"id": "ok", "type": "soak", "x": 50, "y": 36, "r": 16, "label": "中距"},
                {"id": "raid", "type": "ranged", "x": 68, "y": 24, "label": "中圈"},
                {"id": "fall", "type": "drop", "x": 84, "y": 56, "r": 6, "label": "拆台"},
            ],
        ),
    ],
    "abilities": [
        ab(
            "腐蚀波",
            "Caustic Waves",
            "重要",
            "毒波推过台面，先一下再跳。波碰到蛋立刻孵蛇。让开蛋。",
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "egg", "type": "mark", "x": 78, "y": 24, "label": "蛋"},
                    {"id": "wave", "type": "proj", "label": "波", "path": [[16, 40], [50, 36], [80, 26]]},
                    {"id": "safe", "type": "melee", "x": 40, "y": 52, "label": "别带过去"},
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "王"},
                ],
            ),
        ),
        ab("腐臭薄膜", "Putrid Membrane", "治疗", "毒鳞蝰孵出时碎片飞人，自然跳伤。蛇要尽快清。"),
        ab(
            "幽魂盘绕",
            "Spectral Coils",
            "重要",
            "幻影蛇身砸地。落点附近人越多越轻。叠上去吃。",
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "soak", "type": "soak", "x": 50, "y": 40, "r": 10, "pulse": True, "label": "叠"},
                    {"id": "m1", "type": "melee", "x": 46, "y": 38},
                    {"id": "m2", "type": "healer", "x": 54, "y": 42},
                    {"id": "m3", "type": "ranged", "x": 50, "y": 46},
                    {"id": "boss", "type": "boss", "x": 50, "y": 24, "label": "王"},
                ],
            ),
        ),
        ab("母神之怒", "Mother's Wrath", "坦克", "把当前目标甩开并锁定，持续高额自然伤。"),
        ab(
            "囚徒之怒",
            "Rage of the Shackled",
            "灭团",
            "全团脉冲伤加落石。这阵子她不护毒心，全力打毒心。",
            scene=sc(
                "circle",
                2800,
                [
                    {"id": "heart", "type": "mark", "x": 50, "y": 36, "label": "毒心", "pulse": True},
                    {"id": "boss", "type": "boss", "x": 50, "y": 28, "label": "不护"},
                    {"id": "dps", "type": "melee", "x": 42, "y": 44, "label": "爆发"},
                    {"id": "rdps", "type": "ranged", "x": 64, "y": 44, "label": "打满"},
                    {"id": "rock", "type": "drop", "x": 72, "y": 20, "r": 4, "label": "石"},
                ],
            ),
        ),
        ab(
            "巨蛇召唤",
            "Call of the Serpent",
            "重要",
            "吼一声震场，天花板掉新子嗣。清。",
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "吼"},
                    {"id": "a1", "type": "add", "label": "子嗣", "path": [[30, 10], [30, 28]]},
                    {"id": "a2", "type": "add", "label": "子嗣", "path": [[70, 10], [70, 28]]},
                    {"id": "kill", "type": "ranged", "x": 50, "y": 50, "label": "清"},
                ],
            ),
        ),
        ab(
            "围猎",
            "Circling Prey",
            "重要",
            "拆一块台，逼人靠拢。近了巨伤击退，13 码外也疼。保持中距。",
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 36, "label": "王"},
                    {"id": "near", "type": "hazard", "x": 50, "y": 36, "r": 7, "label": "近了"},
                    {"id": "ok", "type": "ranged", "x": 68, "y": 26, "label": "中距"},
                    {"id": "fall", "type": "drop", "x": 86, "y": 54, "r": 6, "label": "掉台"},
                ],
            ),
        ),
    ],
}

NYMRISSA = {
    "wipefestSlug": "nymrissa-wavecaller",
    "positions": [
        pos(
            "水泡控鱼人",
            "水泡一出就转火控滩行者。进泡变狂战士。王位固定，方便拦截。",
            "circle",
            3600,
            [
                {"id": "bubble", "type": "hazard", "x": 50, "y": 36, "r": 9, "label": "水泡", "pulse": True},
                {"id": "m1", "type": "add", "label": "滩行", "path": [[18, 20], [30, 26], [42, 32]]},
                {"id": "m2", "type": "add", "label": "滩行", "path": [[82, 50], [70, 44], [58, 40]]},
                {"id": "stop", "type": "soak", "x": 36, "y": 28, "r": 6, "pulse": True, "label": "控住"},
                {"id": "boss", "type": "boss", "x": 50, "y": 54, "label": "王"},
                {"id": "tank", "type": "tank", "x": 50, "y": 62, "label": "固定"},
            ],
        ),
        pos(
            "破泡留空",
            "破泡全团击退。身后留空，别被推进漩涡。史诗水箭可冲残留寒霜。",
            "circle",
            3400,
            [
                {"id": "bubble", "type": "hazard", "x": 50, "y": 36, "r": 8, "label": "破泡"},
                {"id": "kb", "type": "ranged", "label": "击退", "path": [[50, 36], [78, 22]]},
                {"id": "pool", "type": "drop", "x": 82, "y": 18, "r": 6, "label": "漩涡"},
                {"id": "raid", "type": "melee", "x": 42, "y": 48, "label": "身后留空"},
                {"id": "boss", "type": "boss", "x": 50, "y": 54, "label": "王"},
            ],
        ),
    ],
    "abilities": [
        ab(
            "诱人水泡",
            "Alluring Bubble",
            "重要",
            "场中大泡，吸泡鳍滩行者。进泡的变狂战士。破泡全团冰霜伤并击退。",
            scene=sc(
                "circle",
                3600,
                [
                    {"id": "bubble", "type": "hazard", "x": 50, "y": 36, "r": 10, "label": "泡", "pulse": True},
                    {"id": "add", "type": "add", "label": "吸进去", "path": [[20, 22], [50, 36]]},
                    {"id": "boss", "type": "boss", "x": 50, "y": 56, "label": "王"},
                ],
            ),
        ),
        ab(
            "泡鳍滩行者",
            "Bubblefin Shorerunner",
            "重要",
            "往水泡跑。减速、定身、击退，进泡前杀掉。",
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "bubble", "type": "hazard", "x": 50, "y": 36, "r": 8, "label": "泡"},
                    {"id": "add", "type": "add", "label": "滩行", "path": [[16, 18], [28, 24], [38, 30]]},
                    {"id": "cc", "type": "ranged", "x": 34, "y": 28, "label": "控杀"},
                    {"id": "stop", "type": "soak", "x": 36, "y": 28, "r": 5, "pulse": True},
                ],
            ),
        ),
        ab(
            "泡鳍狂战士",
            "Bubblefin Berserker",
            "灭团",
            "进泡后变身，脉动潮汐打全团。立刻转火。",
            scene=sc(
                "circle",
                2800,
                [
                    {"id": "bubble", "type": "hazard", "x": 50, "y": 36, "r": 9, "label": "泡"},
                    {"id": "berz", "type": "add", "x": 50, "y": 36, "label": "狂战士", "pulse": True},
                    {"id": "kill", "type": "melee", "x": 62, "y": 44, "label": "转火"},
                ],
            ),
        ),
        ab(
            "激荡漩涡",
            "Swirling Whirlpools",
            "重要",
            "漩涡冲向水泡，路上冰霜伤，并破泡强化泡内鱼人。躲开路径。",
            scene=sc(
                "circle",
                3400,
                [
                    {"id": "bubble", "type": "hazard", "x": 50, "y": 36, "r": 8, "label": "泡"},
                    {"id": "whirl", "type": "drop", "label": "漩涡", "path": [[18, 56], [32, 48], [50, 36]], "r": 6},
                    {"id": "safe", "type": "ranged", "x": 70, "y": 24, "label": "躲开"},
                ],
            ),
        ),
        ab(
            "深渊之雨",
            "Abyssal Rain",
            "治疗",
            "全团冰霜爆发。英雄给王叠唤波者之力。",
            normalText="全团冰霜爆发。铺好治疗。",
        ),
        ab(
            "水箭",
            "Water Jet",
            "坦克",
            "对当前目标持续水压，会推人并提高后续水箭和冰霜受伤。",
            mythicText="对当前目标持续水压，会推人。史诗用来冲掉残留寒霜。",
            scene=sc(
                "circle",
                3000,
                [
                    {"id": "boss", "type": "boss", "x": 50, "y": 50, "label": "王"},
                    {"id": "tank", "type": "tank", "label": "被推", "path": [[50, 58], [50, 18]]},
                    {"id": "jet", "type": "proj", "from": "boss", "to": "tank"},
                    {"id": "space", "type": "mark", "x": 50, "y": 12, "label": "留空"},
                ],
            ),
        ),
        ab(
            "刺骨寒霜",
            "Chilling Frost",
            "重要",
            "点名减速并留冰球。英雄：不踩会炸。踩了出残留寒霜，人会打滑。",
            normalText="点名减速并留冰。躲开，别把路堵死。",
            diffs=["heroic", "mythic"],
            scene=sc(
                "circle",
                3200,
                [
                    {"id": "orb", "type": "soak", "x": 34, "y": 28, "r": 6, "pulse": True, "label": "踩"},
                    {"id": "p1", "type": "ranged", "x": 34, "y": 28, "label": "指定"},
                    {"id": "frost", "type": "drop", "x": 28, "y": 40, "r": 5, "label": "寒霜"},
                    {"id": "path", "type": "add", "label": "鱼人路", "path": [[16, 20], [50, 36]]},
                    {"id": "bad", "type": "mark", "x": 42, "y": 32, "label": "别堵路"},
                ],
            ),
        ),
        ab(
            "冰面",
            "Chilling Frost",
            "重要",
            "点名减速并留冰。躲开落点，别把鱼人拦截线堵死。",
            methodText="Chilling Frost",
            icyText="Chilling Frost",
            diffs=["normal"],
        ),
        ab("无尽潮汐", "Unending Tides", "灭团", "后期全团连续水击。软狂暴，必须在这之前打短。"),
    ],
}

PATCH = {
    "vashnik": VASHNIK,
    "sszorak": SSZORAK,
    "twinfangs": TWINFANGS,
    "altar": ALTAR,
    "ulatek": ULATEK,
    "nymrissa": NYMRISSA,
}


def main():
    data = json.loads(PATH.read_text(encoding="utf-8"))
    found = set()
    for inst in data.get("instances") or []:
        for boss in inst.get("bosses") or []:
            patch = PATCH.get(boss.get("id"))
            if not patch:
                continue
            found.add(boss["id"])
            if patch.get("wipefestSlug"):
                boss["wipefestSlug"] = patch["wipefestSlug"]
            boss["positions"] = patch["positions"]
            boss["abilities"] = patch["abilities"]
            keys = [k for k in boss.keys() if k not in ("wipefestSlug", "positions")]
            ordered = []
            for k in keys:
                if k == "abilities":
                    if "wipefestSlug" in boss and "wipefestSlug" not in ordered:
                        insert_after = next((x for x in ("icyUrl", "methodUrl", "nameEn") if x in ordered), None)
                        if insert_after:
                            i = ordered.index(insert_after) + 1
                            ordered[i:i] = ["wipefestSlug"]
                        else:
                            ordered.append("wipefestSlug")
                    ordered.append("positions")
                ordered.append(k)
            rebuilt = {k: boss[k] for k in ordered}
            boss.clear()
            boss.update(rebuilt)
    missing = set(PATCH) - found
    if missing:
        raise SystemExit(f"missing bosses: {sorted(missing)}")
    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("patched", ", ".join(sorted(found)))


if __name__ == "__main__":
    main()

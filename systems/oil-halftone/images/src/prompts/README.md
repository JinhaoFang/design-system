# 生图配方

油画网点的插图都是古典油画加网点设备，代码画不出油画的笔触，所以一律用生图模型（`docs/workflow/README.md`「图像与评审」）。这里只放提示词和做法，不放接口地址和密钥（方案第 5.4 节）。

| 图像标识 | 提示词 | 请求尺寸 | 成品宽度 | 用在 |
| --- | --- | --- | --- | --- |
| `chalou` | `chalou.txt` | 1536x1024 | 1600 | 体系样张首屏 |
| `speaker-boatman` | `speaker-boatman.txt` | 1024x1024 | 720 | 体系样张「录」 |
| `speaker-embroiderer` | `speaker-embroiderer.txt` | 1024x1024 | 720 | 体系样张「录」 |
| `speaker-fisher` | `speaker-fisher.txt` | 1024x1024 | 720 | 体系样张「录」 |
| `speaker-singer` | `speaker-singer.txt` | 1024x1024 | 720 | 体系样张「录」 |
| `huilai` | `huilai.txt` | 1536x1024 | 1600 | 体系样张「回」 |
| `shou` | `shou.txt` | 1024x1024 | 1000，`--no-balance --crop 0.07,0.08,0.86,0.84` | 体系样张深青段 |
| `crowd` | `crowd.txt` | 1536x1024 | 1800 | 体系样张页脚前群像 |
| `dome-night` | `dome-night.txt` | 1536x1024 | 1400 | 测试内容 |
| `primary-mirror` | `primary-mirror.txt` | 1536x1024 | 1400 | 测试内容 |
| `summit-road` | `summit-road.txt` | 1536x1024 | 1400 | 测试内容 |
| `eyepiece-night` | `eyepiece-night.txt` | 1536x1024 | 1400 | 测试内容 |

- 模型与参数：需求方配置的 gpt-image 系列模型，`quality: high`。提示词文件第一行 `#size` 是请求尺寸，其余是提示词；每张的后半段是同一段画风要求：布面油画、北窗光、土黄橄榄灰绿深青的色调，只有现代设备印成黑白网点、边缘散成深青方块，四周渐隐进暖米白纸，不出现文字。
- 人物：当代普通人，不画真实名人；方言讲述者的地域、职业和画面里的方言一致。
- 成品：`node systems/oil-halftone/images/src/finish.mjs <原图.png> images/<标识>.webp --width <成品宽度> --clamp`。先把原图四角的纸色校正到体系纸色，再把比纸更亮的像素压到纸色，使画作的渐隐边缘在入场动画时也和页面无缝。`shou` 的四角是深青底，不校正纸色，并裁掉原图的米白边。
- 挑图：每次生成后逐张看，网点只出现在现代设备上、人物姿态自然才用。生成原图不进 git，只提交成品。

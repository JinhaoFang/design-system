# 生图配方

色纸剪贴的叶子、剪出的数字和负形色纸都用代码画（`images/src/lib/leaves.mjs`、`art/arrange.mjs`），每片叶子是独立的元素。只有测试内容里有人物和场景的四张插图用生图模型（`docs/workflow/README.md`「图像与评审」）。这里只放提示词和做法，不放接口地址和密钥（方案第 5.4 节）。

| 图像标识 | 提示词 | 请求尺寸 | 成品宽度 |
| --- | --- | --- | --- |
| `dome-night` | `dome-night.txt` | 1536x1024 | 1400 |
| `primary-mirror` | `primary-mirror.txt` | 1536x1024 | 1400 |
| `summit-road` | `summit-road.txt` | 1536x1024 | 1400 |
| `eyepiece-night` | `eyepiece-night.txt` | 1536x1024 | 1400 |

- 模型与参数：需求方配置的 gpt-image 系列模型，`quality: high`。提示词文件第一行 `#size` 是请求尺寸（服务实际返回的画幅可能不同，照用），其余是提示词；每张的后半段是同一段画风要求：水粉刷色的手剪纸拼贴、圆钝的手剪边缘、只用体系的八种颜色加浅暖灰纸、人物是无五官的剪影、不出现文字。
- 成品：`node systems/cut-paper/images/src/finish.mjs <原图.png> images/<标识>.webp --width 1400`，把原图四角的纸色校正到体系纸色。不加 `--clamp`：剪纸里有比纸更白的白色纸片（例如圆顶），压到纸色就看不见了。
- 挑图：每次生成后逐张看，颜色没有跑出八种、剪纸边缘不是矢量硬边才用。生成原图不进 git，只提交成品。

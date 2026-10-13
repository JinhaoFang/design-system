# 生图配方

孔版印刷体系样张「纱厂屋顶 · 秋夜露天电影季」里，人物、放映现场和片单海报用代码画会显得假，所以改用生图模型（`docs/workflow/README.md`「图像与评审」）。这里只放提示词和做法，不放接口地址和密钥（方案第 5.4 节）。

| 图像标识 | 提示词 | 请求尺寸 | 成品宽度 |
| --- | --- | --- | --- |
| `projector-night` | `projector-night.txt` | 1536x1024 | 1200 |
| `rooftop-audience` | `rooftop-audience.txt` | 1536x1024 | 1600，加 `--trim` 去掉纸边（满版用） |
| `film-moon` | `film-moon.txt` | 1024x1536 | 720 |
| `film-locomotive` | `film-locomotive.txt` | 1024x1536 | 720 |
| `film-lamp` | `film-lamp.txt` | 1024x1536 | 720 |
| `film-windows` | `film-windows.txt` | 1024x1536 | 720 |
| `film-wall` | `film-wall.txt` | 1024x1536 | 720 |
| `film-birds` | `film-birds.txt` | 1024x1536 | 720 |
| `riso-stall` | `riso-stall.txt` | 1024x1024 | 800 |

- 生图模型：需求方配置的 gpt-image 系列模型，`quality: high`。每张提示词的开头都是同一段画风要求：蓝、粉双墨，暖纸，粗网点，模版毛边，不出现文字。
- 人物：只画背影或很小的剪影，不画演员本人的样貌。六张片单海报只画影片里的场景。
- 分色：模型给的颜色不直接用。原图用 `node systems/riso-print/images/src/separate.mjs <原图.png> images/<标识>.webp --width <成品宽度> --quality 0.72` 转成严格的双墨稿：先把原图的纸色校正到体系纸色，再把每个像素吸附到两只墨能印出的四种颜色上（纸、蓝、粉、粉叠蓝的紫），量化误差扩散到相邻像素。成品只含这四种颜色，符合「双墨纪律」。
- 挑图：每次生成后逐张看，人物姿态、场景与片名对得上才用。生成原图不进 git，只提交分色后的成品。

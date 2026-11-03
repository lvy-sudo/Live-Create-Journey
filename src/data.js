/* =========================================================
   全站唯一内容配置
   ---------------------------------------------------------
   1. 首页三个主分类固定，请勿增删 categories 项。
   2. 每个主分类下的 items 是二级方框，可在网页里直接增删。
   3. 所有修改会自动保存到浏览器本地，不会改写此文件。
   4. links：相关链接；photos：摄影作品；notes：旅行游记记录。
   ========================================================= */
window.LCJ_DEFAULT_DATA = {
  version: 2,
  site: {
    name: "Live · Create · Journey",
    intro: "在这里，收藏我持续创造、学习与感受生活的痕迹。",
    description: "个人项目、技能与兴趣展示。",
    footer: "Selected works & everyday inspiration"
  },
  categories: [
    {
      id: "projects",
      title: "个人项目",
      subtitle: "Projects",
      description: "一些正在生长中的想法，以及已经落地的作品。点击项目进入详情页。",
      accent: "#315f55",
      kind: "standard",
      itemNoun: "项目",
      items: [
        {
          id: "tomato-clock",
          title: "番茄钟",
          description: "专注计时与任务记录工具",
          body: "从一个简单的计时器开始，逐步加入任务清单、专注统计和轻量提醒，让专注变成可以持续的小习惯。",
          links: [
            {
              id: "tomato-link",
              label: "打开项目",
              url: "https://example.com/tomato-clock"
            }
          ]
        },
        {
          id: "mini-game",
          title: "小游戏",
          description: "轻松有趣的浏览器互动小游戏",
          body: "用原生 HTML、CSS 和 JavaScript 做的小型互动实验，重点在于即时反馈和轻快的手感。",
          links: [
            {
              id: "game-link",
              label: "开始游玩",
              url: "https://example.com/mini-game"
            }
          ]
        },
        {
          id: "personal-blog",
          title: "个人博客",
          description: "记录创作、思考与生活片段",
          body: "把零散的思考整理成可以回看的内容，记录项目过程、阅读笔记和生活中的小发现。",
          links: [
            {
              id: "blog-link",
              label: "阅读博客",
              url: "https://example.com/blog"
            }
          ]
        }
      ]
    },
    {
      id: "skills",
      title: "技能展示",
      subtitle: "Skills",
      description: "工具只是表达的起点。这里收录我熟悉的技能，以及它们对应的作品或学习记录。",
      accent: "#8b6746",
      kind: "standard",
      itemNoun: "技能",
      items: [
        {
          id: "html-css",
          title: "HTML / CSS",
          description: "语义化页面、响应式布局与细腻动效",
          body: "关注清晰的信息结构、自然的响应式布局，以及克制但有温度的界面动效。",
          links: [
            {
              id: "html-css-link",
              label: "查看示例",
              url: "https://example.com/html-css"
            }
          ]
        },
        {
          id: "python",
          title: "Python",
          description: "自动化脚本、数据处理与小型应用",
          body: "用 Python 处理重复工作、整理数据，并把想法快速做成可以运行的小工具。",
          links: [
            {
              id: "python-link",
              label: "查看学习记录",
              url: "https://example.com/python"
            }
          ]
        },
        {
          id: "photoshop",
          title: "Photoshop",
          description: "视觉设计、图像处理与内容创作",
          body: "从配色、构图到细节修饰，用视觉语言把内容整理得更准确、更有记忆点。",
          links: [
            {
              id: "photoshop-link",
              label: "查看作品",
              url: "https://example.com/photoshop"
            }
          ]
        }
      ]
    },
    {
      id: "hobbies",
      title: "兴趣爱好",
      subtitle: "Hobbies",
      description: "工作之外，我也在光影、文字与旅途中收集灵感。点击条目查看相册或游记。",
      accent: "#526b86",
      kind: "standard",
      itemNoun: "兴趣",
      items: [
        {
          id: "photography",
          title: "摄影",
          description: "用镜头保存光线、街道与旅途中的瞬间",
          body: "光线、街道、人物与偶然经过的风景。这里收集一些被镜头留下来的片段。",
          kind: "photography",
          links: [],
          portfolios: [
            {
              id: "city-light",
              title: "城市光影",
              description: "在熟悉的街道里，重新寻找光线落下的方向。",
              photos: [
                {
                  id: "photo-city-light",
                  ref: "assets/images/yves-alarie-62qybFmz4p0-unsplash.jpg",
                  alt: "城市光影",
                  caption: "城市光影"
                }
              ]
            }
          ]
        },
        {
          id: "reading",
          title: "阅读",
          description: "从小说、设计到人文社科，持续拓宽视角",
          body: "阅读是另一种缓慢的旅行。这里记录最近读过的书、留下的句子和偶尔冒出的想法。",
          kind: "reading",
          links: [
            {
              id: "reading-link",
              label: "查看书单",
              url: "https://example.com/reading"
            }
          ]
        },
        {
          id: "travel",
          title: "旅行",
          description: "走进陌生城市，记录沿途的风景与故事",
          body: "把路上的光线、气味和心情，整理成一篇篇可以重新打开的游记。",
          kind: "travel",
          links: [],
          travelogues: [
            {
              id: "coastal-road",
              title: "沿海公路",
              date: "2026.10",
              description: "沿着海岸线向北，把风、海浪和傍晚的光一起收进这段旅程。",
              notes: [
                {
                  id: "coastal-road-note",
                  date: "2026.10.18",
                  text: "沿着海岸线开了很久，风从车窗灌进来。傍晚的光落在海面上，像一条缓慢移动的银色道路。",
                  photos: [
                    {
                      id: "coastal-road-photo",
                      ref: "assets/images/yves-alarie-62qybFmz4p0-unsplash.jpg",
                      alt: "沿海公路的傍晚",
                      caption: "沿海公路的傍晚"
                    }
                  ]
                }
              ]
            },
            {
              id: "kyoto-slow-walk",
              title: "慢行京都",
              date: "2026.04",
              description: "没有赶路，只沿着小巷慢慢走，记录春天经过城市的声音。",
              notes: []
            }
          ]
        }
      ]
    }
  ]
};


# 每日复盘（market-diary）

记录每天开盘 / 收盘的照片，并结合当天新闻做简单复盘分析。发布在 GitHub Pages：`https://c2isp1228.github.io/market-diary/`

## 结构

```
market-diary/
├── index.html          页面骨架
├── css/style.css       样式（自适应手机 / 深色模式）
├── js/data.js          ★ 每天的数据都写在这里
├── js/app.js           渲染逻辑（一般不用改）
└── photos/             照片目录，按日期存
    └── YYYY-MM-DD/
        ├── open.jpg
        └── close.jpg
```

## 每天怎么更新（由 Claude 操作）

1. 收到当天的开盘 / 收盘照片，保存到 `photos/YYYY-MM-DD/`。
2. 在 `js/data.js` 的 `entries` 数组最前面新增一条：
   ```js
   {
     date: "2026-09-22",
     summary: "一句话总结",
     photos: [
       { label: "开盘", src: "photos/2026-09-22/open.jpg", note: "上证 3210" },
       { label: "收盘", src: "photos/2026-09-22/close.jpg", note: "上证 3234" }
     ],
     analysis: "……支持 **加粗**、- 列表、## 小标题……",
     news: [
       { title: "新闻标题", url: "https://…", impact: "利好" }
     ]
   }
   ```
3. 更新 `updated` 字段为当天日期，提交并推送，页面即自动更新。

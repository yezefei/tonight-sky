// 自定义 tabBar：今夜 / 星空 / 我的
// 用 CSS 画图标，不依赖图片资源；选中态由各 tab 页 onShow 主动同步。
Component({
  data: {
    selected: 0,
    list: [
      { path: '/pages/sky/sky', key: 'night', label: '今夜' },
      { path: '/pages/stars/stars', key: 'stars', label: '星空' },
      { path: '/pages/settings/settings', key: 'mine', label: '我的' }
    ]
  },
  methods: {
    onTap(e) {
      const { path, index } = e.currentTarget.dataset;
      if (Number(index) === this.data.selected) return;
      wx.switchTab({ url: path });
    }
  }
});

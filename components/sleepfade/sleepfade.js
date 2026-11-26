Component({
  properties: {
    show: { type: Boolean, value: false },
    message: { type: String, value: '把手机放下吧，我已经替你记着了。' }
  },
  methods: {
    onWake() { this.triggerEvent('exit'); },
    noop() {}
  }
});

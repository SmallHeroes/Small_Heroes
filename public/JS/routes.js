window.SH_ROUTES = Object.freeze({
  home: '/',
  wizard: '/wizard',
  login: '/login',
  myBooks: '/my-books',
  generating: '/generating',
  ready: '/ready',
  reader: '/reader',
  readerV2: function readerV2(orderId, accessKey) {
    var params = new URLSearchParams({ v: '1' });
    if (accessKey) params.set('accessKey', accessKey);
    return '/book/' + encodeURIComponent(orderId) + '/read-v2?' + params.toString();
  },
});

navigator.serviceWorker.register('sw-simple.js')
.then(reg => {
  if (reg.installing) {
    const sw = reg.installing || reg.waiting;
    sw.onstatechange = function() {
      if (sw.state === 'installed') {
        onward();
      }
    };
  } else if (reg.active) {
    status('<p>Service Worker is installed and not functioning as intended.<p>Please contact developer.')
  }
})
.catch(error => status(error))


function onward() {
  setTimeout(function() {
    window.location.reload();
  },2000);
}

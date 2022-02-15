self.addEventListener('fetch', event => {
  const params = new URLSearchParams(event.request.url.split('?')[1]);
  let attackerControlledString = params.get('attackerControlledString');
  
  if (attackerControlledString) {
    init = {
      headers: {
        'Content-Type': 'text/html',
        'Content-Security-Policy': "require-trusted-types-for 'script'; trusted-types 'none';"
          
      }
    };
    event.respondWith(new Response(attackerControlledString, init));
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        return response;
      }

      return fetch(event.request).then(
        function(response) {
          if(!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          const responseToCache = response.clone();
    
          caches.open("v1").then(cache => {
            cache.put(event.request, responseToCache);
          });
    
          return response;
        }
      );
    })
  );
});

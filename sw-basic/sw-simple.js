const progressIndicatorUrls = /\?requestId=/i;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetchWithProgressMonitor(event));
});

function fetchWithProgressMonitor(event) {
  console.log(event);

  if (event.request.url.includes("www.google-analytics.com"))
    return fetch(event.request);

  const newRequest = new Request(event.request, {
    mode: "cors",
    credentials: "omit",
  });
  return fetch(newRequest).then((response) =>
    respondWithProgressMonitor(event.clientId, response),
  );
}

function respondWithProgressMonitor(clientId, response) {
  if (!response.body) {
    console.warn(
      "ReadableStream is not yet supported in this browser.  See https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream",
    );
    return response;
  }
  if (!response.ok) {
    return response;
  }

  const contentEncoding = response.headers.get("content-encoding");
  const contentLength = response.headers.get(
    contentEncoding ? "x-file-size" : "content-length",
  );
  if (contentLength === null) {
    console.warn("Response size header unavailable. Cannot measure progress");
    return response;
  }

  let loaded = 0;
  debugReadIterations = 0;
  const total = parseInt(contentLength, 10);
  const reader = response.body.getReader();

  return new Response(
    new ReadableStream({
      start(controller) {
        let client;
        clients.get(clientId).then((c) => {
          client = c;
          read();
        });

        function read() {
          debugReadIterations++;
          reader
            .read()
            .then(({ done, value }) => {
              if (done) {
                console.log("read()", debugReadIterations);
                controller.close();
                return;
              }

              controller.enqueue(value);
              loaded += value.byteLength;
              dispatchProgress({ client, loaded, total });
              read();
            })
            .catch((error) => {
              console.error("error in read()", error);
              controller.error(error);
            });
        }
      },
      cancel(reason) {
        console.log("cancel()", reason);
      },
    }),
  );
}

function dispatchProgress({ client, loaded, total }) {
  client.postMessage({ loaded, total });
}

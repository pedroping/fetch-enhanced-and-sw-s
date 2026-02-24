"use strict";

class ProgressReportFetcher {
  constructor(onProgress = function () {}) {
    this.onProgress = onProgress;
  }

  fetch(input, init = {}) {
    const request = input instanceof Request ? input : new Request(input);
    this._cancelRequested = false;

    return fetch(request, init).then((response) => {
      if (!response.body) {
        throw Error(
          'ReadableStream is not yet supported in this browser.  <a href="https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream">More Info</a>',
        );
      }
      if (this._cancelRequested) {
        response.body.getReader().cancel();
        return Promise.reject("cancel requested before server responded.");
      }

      if (!response.ok) {
        throw Error(
          `Server responded ${response.status} ${response.statusText}`,
        );
      }

      const contentEncoding = response.headers.get("content-encoding");
      const contentLength = response.headers.get(
        contentEncoding ? "x-file-size" : "content-length",
      );
      if (contentLength === null) {
        throw Error("Response size header unavailable");
      }

      const total = parseInt(contentLength, 10);
      let loaded = 0;

      this._reader = response.body.getReader();

      const me = this;

      return new Response(
        new ReadableStream({
          start(controller) {
            if (me.cancelRequested) {
              console.log("canceling read");
              controller.close();
              return;
            }

            read();
            function read() {
              me._reader
                .read()
                .then(({ done, value }) => {
                  if (done) {
                    if (total === 0) {
                      me.onProgress.call(me, { loaded, total });
                    }

                    controller.close();
                    return;
                  }

                  loaded += value.byteLength;
                  me.onProgress.call(me, { loaded, total });
                  controller.enqueue(value);
                  read();
                })
                .catch((error) => {
                  console.error(error);
                  controller.error(error);
                });
            }
          },
        }),
      );
    });
  }

  cancel() {
    console.log("download cancel requested.");
    this._cancelRequested = true;
    if (this._reader) {
      console.log("cancelling current download");
      return this._reader.cancel();
    }
    return Promise.resolve();
  }
}

const imageLoader = (function () {
  const loader = document.getElementById("loader");
  const img = loader.querySelector("img");
  const errorMsg = loader.querySelector(".error");
  const loading = loader.querySelector(".progress-bar");
  const progress = loader.querySelector(".progress");

  let locked, started, progressFetcher, pct;

  function downloadDone(url) {
    console.log(url);

    console.log("downloadDone()");
    const a = document.createElement("a");
    a.href = url;
    a.download = "sunrise-baseline.jpg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    img.src = url;
    img.offsetWidth;
    loader.classList.remove("loading");
    loader.classList.add("loading-complete");
    progressFetcher = null;
  }

  function startDownload() {
    if (locked) {
      console.error(
        "startDownload() failed. Previous download not yet initialized",
      );
      return;
    }

    locked = true;
    stopDownload().then(function () {
      locked = false;

      progress.style.transform = `scaleX(0)`;
      progress.offsetWidth;
      started = false;
      pct = 0;

      loader.classList.add("loading");
      loader.classList.remove("loading-complete");

      if (!progressFetcher) {
        progressFetcher = new ProgressReportFetcher(updateDownloadProgress);
      }

      console.log("Starting download...");
      progressFetcher
        .fetch(
          "https://fetch-progress.anthum.com/30kbps/images/sunrise-baseline.jpg",
        )
        .then((response) => response.blob())
        .then((blob) => URL.createObjectURL(blob))
        .then((url) => downloadDone(url))
        .catch((error) => showError(error));
    });
  }

  function stopDownload() {
    if (progressFetcher) {
      return progressFetcher.cancel();
    } else {
      return Promise.resolve();
    }
  }

  function showError(error) {
    console.error(error);
    loader.classList.remove("loading");
    loader.classList.remove("loading-complete");
    loader.classList.remove("loading-error");
    errorMsg.offsetWidth;
    errorMsg.innerHTML = "ERROR: " + error.message;
    loader.classList.add("loading-error");
  }

  function updateDownloadProgress({ loaded, total }) {
    if (!started) {
      loader.classList.add("loading");
      started = true;
    }

    pct = total ? loaded / total : 1;

    progress.style.transform = `scaleX(${pct})`;
    if (loaded === total) {
      console.log("download complete");
    }
  }

  return {
    startDownload,
    stopDownload,
  };
})();

imageLoader.startDownload();

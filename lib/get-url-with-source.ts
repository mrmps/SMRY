export function getUrlWithSource(source: string, url: string) {
    let urlWithSource;
    switch (source) {
      case "direct":
        urlWithSource = url;
        break;
      case "wayback":
        urlWithSource = `https://web.archive.org/web/2/${encodeURIComponent(
          url
        )}`;
        break;
      // case "google":
      //   const cleanUrl = url.replace(/^https?:\/+/, "");
      //   const finalUrl = `https://${cleanUrl}`;
      //   urlWithSource = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(
      //     finalUrl
      //   )}`;
      //   break;
      case "jina.ai":
        urlWithSource = `https://r.jina.ai/${url}`;
        break;
      default:
        throw new Error(`Invalid source parameter: ${source}`);
    }
    return urlWithSource;
  }
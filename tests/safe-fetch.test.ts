import { beforeAll, afterAll, describe, expect, it } from "bun:test";
import * as http from "http";
import { safeFetch } from "@/lib/safe-fetch";

let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = http
      .createServer((req, res) => {
        if (req.url === "/redirect") {
          res.statusCode = 301;
          res.setHeader("Location", "/final");
          res.end();
          return;
        }

        if (req.url === "/final") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/plain");
          res.end("redirect complete");
          return;
        }

        res.statusCode = 404;
        res.end("not found");
      })
      .listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          baseUrl = `http://127.0.0.1:${address.port}`;
        }
        resolve();
      });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("safeFetch", () => {
  it("follows redirects by default", async () => {
    const response = await safeFetch(`${baseUrl}/redirect`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("redirect complete");
  });

  it("leaves redirects alone when redirect mode is manual", async () => {
    const response = await safeFetch(`${baseUrl}/redirect`, { redirect: "manual" });
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/final");
  });
});

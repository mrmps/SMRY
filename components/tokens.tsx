
/**
 * Create a piece of changable UI that can be streamed to the client.
 * On the client side, it can be rendered as a normal React node.
 */
import React, { Suspense } from "react";
import ReactMarkdown from "react-markdown";
import gfm from 'remark-gfm'; // GitHub flavored markdown
import breaks from 'remark-breaks'; // Converts newlines to <br/> tags
import { UpdateIcon } from "@radix-ui/react-icons";

export function createResolvablePromise<T = any>() {
  let resolve: (value: T) => void, reject: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

// Use the name `R` for `Row` as it will be shorter in the RSC payload.
const R = [
  (async ({
    c, // current
    n, // next
  }: {
    c: React.ReactNode;
    n: Promise<any>;
  }) => {
    const chunk = await n;
    if (chunk.done) {
      return chunk.value;
    }

    if (chunk.append) {
      return (
        <>
          {c}
          <Suspense fallback={chunk.value}>
            <R c={chunk.value} n={chunk.next} />
          </Suspense>
        </>
      );
    }

    return (
      <Suspense fallback={chunk.value}>
        <R c={chunk.value} n={chunk.next} />
      </Suspense>
    );
  }) as unknown as React.FC<{
    c: React.ReactNode;
    n: Promise<any>;
  }>,
][0];

export function createSuspensedChunk(initialValue: React.ReactNode) {
  const { promise, resolve, reject } = createResolvablePromise();

  return {
    row: (
      <Suspense fallback={initialValue}>
        <R c={initialValue} n={promise} />
      </Suspense>
    ),
    resolve,
    reject,
  };
}

export const isFunction = (x: unknown): x is Function =>
  typeof x === "function";

export const consumeStream = async (stream: ReadableStream) => {
  const reader = stream.getReader();
  while (true) {
    const { done } = await reader.read();
    if (done) break;
  }
};

export function createStreamableUI(initialValue?: React.ReactNode) {
  let currentValue = initialValue;
  let closed = false;
  let { row, resolve, reject } = createSuspensedChunk(initialValue);

  function assertStream(method: string) {
    if (closed) {
      throw new Error(method + ": UI stream is already closed.");
    }
  }

  let warningTimeout: NodeJS.Timeout | undefined;
  function warnUnclosedStream() {
    if (process.env.NODE_ENV === "development") {
      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      warningTimeout = setTimeout(() => {
        console.warn(
          "The streamable UI has been slow to update. This may be a bug or a performance issue or you forgot to call `.done()`."
        );
      }, 1000000);
    }
  }
  warnUnclosedStream();

  return {
    value: row,
    update(value: React.ReactNode) {
      assertStream(".update()");

      // There is no need to update the value if it's referentially equal.
      if (value === currentValue) {
        warnUnclosedStream();
        return;
      }

      const resolvable = createResolvablePromise();
      currentValue = value;

      resolve({ value: currentValue, done: false, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;

      warnUnclosedStream();
    },
    append(value: React.ReactNode) {
      assertStream(".append()");

      const resolvable = createResolvablePromise();
      currentValue = value;

      resolve({ value, done: false, append: true, next: resolvable.promise });
      resolve = resolvable.resolve;
      reject = resolvable.reject;

      warnUnclosedStream();
    },
    error(error: any) {
      assertStream(".error()");

      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      reject(error);
    },
    done(...args: [] | [React.ReactNode]) {
      assertStream(".done()");

      if (warningTimeout) {
        clearTimeout(warningTimeout);
      }
      closed = true;
      if (args.length) {
        resolve({ value: args[0], done: true });
        return;
      }
      resolve({ value: currentValue, done: true });
    },
  };
}

type Props = {
  /**
   * A ReadableStream produced by the AI SDK.
   */
  stream: ReadableStream<Uint8Array>;
};

/**
 * A React Component that renders a stream of tokens.
 */
export function Tokens({ stream }: Props) {
  const ui = React.useMemo(() => {
    const { value, update, done } = createStreamableUI();
    const reader = stream.getReader();
    let previousText = "";

    async function readStream() {
      let result;
      while (!(result = await reader.read()).done) {
        const text = new TextDecoder().decode(result.value);
        previousText += text;
        update(<ReactMarkdown remarkPlugins={[gfm]}>{previousText}</ReactMarkdown>); // Render the accumulated text as Markdown
        // update(previousText)
      }
      done(); // Mark the stream as finished
    }

    readStream().catch((error) => {
      console.error("Error reading stream:", error);
      done(<span>Error loading content</span>); // Handle stream error
    });

    return value; // Return the streamable UI element
  }, [stream]);

  return <>{ui}</>;
}

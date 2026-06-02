import type { DetailedHTMLProps, HTMLAttributes } from "react";

type AdsgramTaskElementProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement> & {
    "data-block-id"?: string;
    "data-debug"?: string;
    "data-debug-console"?: string;
  },
  HTMLElement
>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "adsgram-task": AdsgramTaskElementProps;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "adsgram-task": AdsgramTaskElementProps;
    }
  }
}

export {};

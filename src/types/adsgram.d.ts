import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "adsgram-task": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "data-block-id"?: string;
          "data-debug"?: string;
          "data-debug-console"?: string;
        },
        HTMLElement
      >;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "adsgram-task": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "data-block-id"?: string;
          "data-debug"?: string;
          "data-debug-console"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export {};

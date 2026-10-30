import {memo} from 'react';
import katex from 'katex';
export const MathText = memo(function MathText({ expression }: { expression: string }) {
 const markup = katex.renderToString(expression, { throwOnError: true, trust: false, output:'htmlAndMathml' });
 return <span dangerouslySetInnerHTML={{ __html: markup }} />;
});

import React, { useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
    formula: string;
    display?: boolean;
    fontSize?: number;
    color?: string;
    background?: string;
}

function buildHtml(formula: string, display: boolean, color: string, bg: string, fs: number): string {
    // JSON.stringify guarantees safe escaping of all special chars
    const json = JSON.stringify(formula);
    const pad = display ? '14px 20px' : '2px 4px';
    const minH = display ? 56 : 24;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
  crossorigin="anonymous">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:${bg};overflow:hidden;width:100%}
body{
  display:flex;
  justify-content:center;
  align-items:center;
  padding:${pad};
  min-height:${minH}px;
}
.katex{color:${color};font-size:${fs}px}
.katex-display{margin:0}
.fb{color:${color};font-family:monospace;font-size:${fs - 2}px;
    word-break:break-all;text-align:center;padding:8px}
</style>
</head>
<body>
<span id="m" class="fb">${formula.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"
  crossorigin="anonymous"></script>
<script>
(function(){
  try{
    katex.render(${json},document.getElementById('m'),{
      displayMode:${display},
      throwOnError:false,
      strict:false,
      macros:{"\\\\RR":"\\\\mathbb{R}"}
    });
    document.getElementById('m').className='';
  }catch(e){}
  var h=document.body.scrollHeight;
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(String(h||${minH}));
})();
</script>
</body>
</html>`;
}

export default function MathFormula({
    formula,
    display = false,
    fontSize,
    color = '#1e293b',
    background = '#ffffff',
}: Props) {
    const fs = fontSize ?? (display ? 19 : 15);
    const initH = display ? 70 : 28;
    const [height, setHeight] = useState(initH);

    if (!formula?.trim()) return null;

    return (
        <View style={{ width: '100%', height, overflow: 'hidden' }}>
            <WebView
                source={{ html: buildHtml(formula, display, color, background, fs) }}
                style={{ flex: 1, backgroundColor: background }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                originWhitelist={['*']}
                mixedContentMode="always"
                javaScriptEnabled
                domStorageEnabled
                onMessage={e => {
                    const h = parseInt(e.nativeEvent.data, 10);
                    if (!isNaN(h) && h > 0)
                        setHeight(h + (display ? 12 : 4));
                }}
            />
        </View>
    );
}

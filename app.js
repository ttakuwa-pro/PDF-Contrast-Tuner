import { getDocument, GlobalWorkerOptions } from './pdfjs/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = './pdfjs/build/pdf.worker.mjs';

var imageDataArray = [];
var currentFileName = ''; // ファイル名を格納する変数

document.getElementById('file-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file || !file.type.match('application/pdf')) {
        console.error("Invalid file type or no file selected.");
        // ファイルがPDFではない場合、またはファイルが選択されていない場合はボタンを無効化
        setButtonsEnabled(false);
        return;
    }

    currentFileName = file.name.replace(/\.[^/.]+$/, ""); // 拡張子を除いたファイル名を保存
    document.getElementById('canvas-container').innerHTML = '';
    imageDataArray = [];

    var fileReader = new FileReader();
    fileReader.onload = function() {
        var typedarray = new Uint8Array(this.result);
        getDocument({data: typedarray}).promise.then(function(pdf) {
            let promises = [];
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                let renderPromise = pdf.getPage(pageNum).then(page => renderPage(page, pageNum - 1));
                promises.push(renderPromise);
            }

            Promise.all(promises).then(() => {
                console.log("All pages rendered.");
                // PDFのレンダリングが完了した後でボタンを有効化
                setButtonsEnabled(true);
            });
        });
    };
    fileReader.readAsArrayBuffer(file);
});

function setButtonsEnabled(enabled) {
    document.getElementById('increase-contrast').disabled = !enabled;
    document.getElementById('decrease-contrast').disabled = !enabled;
    document.getElementById('reset-contrast').disabled = !enabled;
    document.getElementById('download-pdf').disabled = !enabled;
}

function renderPage(page, index) {
    var scale = 7; // 解像度を高めるためのスケールファクター
    var viewport = page.getViewport({ scale: scale });
    var canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    var context = canvas.getContext('2d');

    return page.render({canvasContext: context, viewport: viewport}).promise.then(function() {
        document.getElementById('canvas-container').appendChild(canvas);
        imageDataArray[index] = {
            original: context.getImageData(0, 0, canvas.width, canvas.height),
            current: null,
            width: viewport.width,
            height: viewport.height
        };
    });
}

function adjustContrast(change) {
    imageDataArray.forEach((data, index) => {
        if (!data) return;  // 追加したチェック
        var canvas = document.getElementsByTagName('canvas')[index];
        if (!canvas) return; // 追加したチェック
        var context = canvas.getContext('2d');
        
        if (!data.current) {
            data.current = new ImageData(
                new Uint8ClampedArray(data.original.data),
                data.original.width,
                data.original.height
            );
        }

        var imageData = data.current;

        for (var i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] += change;  
            imageData.data[i+1] += change;  
            imageData.data[i+2] += change;  

            imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i]));
            imageData.data[i+1] = Math.min(255, Math.max(0, imageData.data[i+1]));
            imageData.data[i+2] = Math.min(255, Math.max(0, imageData.data[i+2]));
        }

        context.putImageData(imageData, 0, 0);
    });
}

document.getElementById('increase-contrast').addEventListener('click', () => {
    showLoading();
    setTimeout(() => {
        adjustContrast(-10);
        hideLoading();
    }, 100); // 100ミリ秒後にコントラスト調整とローディング非表示を行う
});

document.getElementById('decrease-contrast').addEventListener('click', () => {
    showLoading();
    setTimeout(() => {
        adjustContrast(30);
        hideLoading();
    }, 100); // 100ミリ秒後にコントラスト調整とローディング非表示を行う
});

document.getElementById('reset-contrast').addEventListener('click', () => {
    showLoading();
    setTimeout(() => {
        imageDataArray.forEach((data, index) => {
            if (!data) return;
            var canvas = document.getElementsByTagName('canvas')[index];
            if (!canvas) return;
            var context = canvas.getContext('2d');
            context.putImageData(data.original, 0, 0);
            data.current = null;
        });
        hideLoading();
    }, 100); // 100ミリ秒後にリセット処理とローディング非表示を行う
});

function formatDate() {
    var d = new Date(),
        month = ('0' + (d.getMonth() + 1)).slice(-2),
        day = ('0' + d.getDate()).slice(-2),
        year = d.getFullYear(),
        hour = ('0' + d.getHours()).slice(-2),
        minute = ('0' + d.getMinutes()).slice(-2);

    return `${year}${month}${day}${hour}${minute}`;
}

document.getElementById('download-pdf').addEventListener('click', () => {
    showLoading();
    setTimeout(() => {
        downloadPDF();
        hideLoading();
    }, 100); // 100ミリ秒後にPDFダウンロード処理とローディング非表示を行う
});

function downloadPDF() {
    const { jsPDF } = window.jspdf;
    let pdf;

    document.querySelectorAll('canvas').forEach((canvas, index) => {
        let imgData = canvas.toDataURL('image/jpeg', 1.0);
        let canvasWidth = imageDataArray[index].width;
        let canvasHeight = imageDataArray[index].height;
        let orientation = (canvasWidth > canvasHeight) ? 'l' : 'p';
        let unit = 'mm', scale = 0.264583333;
        let format = [canvasWidth * scale, canvasHeight * scale];

        if (index === 0) {
            pdf = new jsPDF(orientation, unit, format);
        } else {
            pdf.addPage(format, orientation);
        }
        
        pdf.addImage(imgData, 'JPEG', 0, 0, format[0], format[1], undefined, 'SLOW');
    });

    let dateTime = formatDate();
    pdf.save(`${currentFileName}_${dateTime}.pdf`);
}

function showLoading() {
    console.log('show loading');
    document.getElementById('overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('overlay').style.display = 'none';
}
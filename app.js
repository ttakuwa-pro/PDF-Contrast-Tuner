import { getDocument, GlobalWorkerOptions } from './pdfjs/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = './pdfjs/build/pdf.worker.mjs';

var imageDataArray = [];
var currentFileName = ''; // ファイル名を格納する変数

document.getElementById('file-input').addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file.type.match('application/pdf')) {
        console.error(file.name + " is not a PDF file.");
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
            });
        });
    };
    fileReader.readAsArrayBuffer(file);
});

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
    adjustContrast(-10);
});

document.getElementById('decrease-contrast').addEventListener('click', () => {
    adjustContrast(10);
});

document.getElementById('reset-contrast').addEventListener('click', () => {
    imageDataArray.forEach((data, index) => {
        if (!data) return;  // 追加したチェック
        var canvas = document.getElementsByTagName('canvas')[index];
        if (!canvas) return; // 追加したチェック
        var context = canvas.getContext('2d');
        context.putImageData(data.original, 0, 0);
        data.current = null;
    });
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

document.getElementById('download-pdf').addEventListener('click', function() {
    const { jsPDF } = window.jspdf;
    let pdf;

    document.querySelectorAll('canvas').forEach((canvas, index) => {
        let imgData = canvas.toDataURL('image/jpeg', 1.0);  // JPEGの代わりにPNGを使用してもよい
        let canvasWidth = imageDataArray[index].width;
        let canvasHeight = imageDataArray[index].height;
        let orientation = (canvasWidth > canvasHeight) ? 'l' : 'p';
        let unit = 'mm', scale = 0.264583333; // 1 pixel = 0.264583333 mm
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
});
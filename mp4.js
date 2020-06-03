"use strict";

document.addEventListener("DOMContentLoaded", function(event) {
    main();
});

function main() {
    console.log("main");
    const container = document.getElementById("container");
    const template = document.getElementById("template");
    template.remove();
    dropFunction(document, function(arrbuf) {
        container.innerHTML = "";
        mp4view(arrbuf, 0, arrbuf.byteLength, 9999, container, template);
    }, "ArrayBuffer");
}

function mp4view(arrbuf, byteOffset, byteLength, maxCount, container, template) {
    const dataview = new DataView(arrbuf);
    let offset = byteOffset;
    let count = 0;
    while (offset < byteLength) {
        let boxLength= dataview.getUint32(offset, false); // big-endian
        if (boxLength <= 4) {
            boxLength = byteLength - offset;
        }
        let table = mp4box(arrbuf, offset, boxLength, template);
        container.append(table);
        offset += boxLength;
        count ++;
        if (count >= maxCount) {
            let div = document.createElement("div");
            div.innerHTML = "(omit...)";
            container.append(div);
            break;
        }
    }
}

function mp4box(arrbuf, boxOffset, boxLength, template) {
    let maxCount = 10;
    const arr = new Uint8Array(arrbuf);
    let boxTypeArr = arr.subarray(boxOffset + 4, boxOffset + 8);
    let boxType = String.fromCharCode.apply("", boxTypeArr);
    console.debug(boxType, boxOffset, boxLength);
    const table = template.cloneNode(true);
    const tbody = table.children[0];
    const [tr0, tr1] = tbody.children;
    tr0.children[0].innerHTML = "length:"+boxLength;
    tr1.children[0].innerHTML = "type:"+boxType;
    //
    const dataview = new DataView(arrbuf);
    let offset = boxOffset + 8;
    let isContainer = false;
    switch (boxType) {
    case "meta":
        {
            const version_and_flag = dataview.getUint32(offset, false); // big-endian
            const version = version_and_flag >> 24;
            const flags = version_and_flag&0xffffff;
            tr1.children[1].innerHTML = "version:"+version + " flags:"+flags;
            offset += 4;
            isContainer = true;
        }
        break;
    case "iinf":
        {
            const version_and_flag = dataview.getUint32(offset, false); // big-endian
            const version = version_and_flag >> 24;
            const flags = version_and_flag&0xffffff;
            offset += 4;
            let count;
            if (version <= 1) {
                count = dataview.getUint16(offset, false);
                offset += 2;
            } else {
                count = dataview.getUint32(offset, false);
                offset += 4;
            }
            tr1.children[1].innerHTML = "version:"+version + " flags:"+flags +
                " count:"+count;
            isContainer = true;
        }
        break;
    case "iprp":
    case "ipco":
    case "moov":
        isContainer = true;
        break;
    }
    if (isContainer) {
        mp4view(arrbuf, offset, boxOffset + boxLength, maxCount, tr1.children[2], template);
    }
    return table;
}

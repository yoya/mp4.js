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
        mp4view(arrbuf, null, 0, arrbuf.byteLength, 9999, container, template);
    }, "ArrayBuffer");
}

function mp4view(arrbuf, parentType, byteOffset, byteLength, maxCount, container, template) {
    const dataview = new DataView(arrbuf);
    let offset = byteOffset;
    let count = 0;
    let omit_count = 0;
    while (offset < byteLength) {
        const realLength= dataview.getUint32(offset, false); // big-endian
        const boxLength = (realLength >= 8)? realLength: byteLength - offset;
        let table = mp4box(arrbuf, parentType, offset, boxLength, realLength,
                           template);
        if (count <  maxCount) {
            container.append(table);
        } else {
            omit_count++;
        }
        offset += boxLength;
        count ++;
    }
    if (omit_count) {
        const div = document.createElement("div");
        div.innerHTML = "(omit...x "+omit_count+")";
        container.append(div);
    }
}

function mp4box(arrbuf, parentType, boxOffset, boxLength, realLength,
                template) {
    let maxCount = 10;
    const arr = new Uint8Array(arrbuf);
    let boxTypeArr = arr.subarray(boxOffset + 4, boxOffset + 8);
    let boxType = String.fromCharCode.apply("", boxTypeArr);
    // console.debug(boxType, boxOffset, boxLength);
    const table = template.cloneNode(true);
    const tbody = table.children[0];
    const [tr0, tr1] = tbody.children;
    tr0.children[0].innerHTML = "offset:"+boxOffset+" length:"+boxLength;
    if (boxLength !== realLength) {
        tr0.children[0].innerHTML += "("+realLength+")";
    }
    tr1.children[0].innerHTML = "type:"+boxType;
    //
    const dataview = new DataView(arrbuf);
    let offset = boxOffset + 8;
    let data = null;
    let isContainer = false;
    switch (boxType) {
        /*
         * no container box
         */
    case "ftyp":
        {
            let brandBytes = arr.subarray(offset, offset + 4);
            let brand = String.fromCharCode.apply("", brandBytes);
            let minorVersion = dataview.getUint32(offset + 4, false);
            data = "brand:"+brand + ", "+minorVersion, + " compat:";
            offset += 8;
            let compatiBrands = [];
            while (offset < boxOffset + boxLength) {
                brandBytes = arr.subarray(offset, offset + 4);
                brand = String.fromCharCode.apply("", brandBytes);
                compatiBrands.push(brand);
                offset += 4;
            }
            data += ", "+compatiBrands.join(", ");
        }
        break;
    case "hdlr":
        {
            const tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const comptypeBytes = arr.subarray(offset + 4, offset + 8);
            const subtypeBytes = arr.subarray(offset + 8, offset + 12);
            const comptype = String.fromCharCode.apply("", comptypeBytes);
            const subtype  = String.fromCharCode.apply("", subtypeBytes);
            data = "version:"+version + " flags:"+flags +
                " type:" + comptype + " subtype:" + subtype;
        }
        break;
    case "pitm":
        {
            const tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const itemId = dataview.getUint16(offset + 4, false);
            data = "version:"+version + " flags:"+flags + " itemId:"+itemId;
        }
        break;
    case "iloc":
        if (parentType === "iref") {
            console.warn(parentType+"=>iloc box not implemented yet.")
        } else {
            // | 1 byte  |  3 bytes  |
            // | version |   flags   |
            let tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            // |   4 bits   |   4 bits   |     4 bits     |   4 bits  |
            // | offsetSize | lengthSize | baseOffsetSize | indexSize |
            tmp = dataview.getUint16(offset + 4);
            const offsetSize     = (tmp >> 12) & 0xF;
            const lengthSize     = (tmp >>  8) & 0xF;
            const baseOffsetSize = (tmp >>  4) & 0xF;
            const indexSize = (version==0)? null: ((tmp >>  0) & 0xF);
            const itemCount = dataview.getUint16(offset + 6);
            data = "version:"+version + " flags:"+flags + " itemCount:"+itemCount;
            offset += 8;
            /*
            for (let i = 0 ; i < itemCount ; i++) {
                let itemId = dataview.getUint16(offset);
                console.log("itemId:"+itemId);
            }
            */a
        }
        break;
        /*
         * container box
         */
    case "meta":
    case "iref":
        {
            const tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            data = "version:"+version + " flags:"+flags;
            offset += 4;
            isContainer = true;
        }
        break;
    case "dref":
        {
            const tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const count = dataview.getUint32(offset + 4, false);
            offset += 8;
            data = "version:"+version + " flags:"+flags + " count:"+count;
            isContainer = true;
        }
        break;
    case "iinf":
        {
            const tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            offset += 4;
            let count;
            if (version <= 1) {
                count = dataview.getUint16(offset, false);
                offset += 2;
            } else {
                count = dataview.getUint32(offset, false);
                offset += 4;
            }
            data = "version:"+version + " flags:"+flags + " count:"+count;
            isContainer = true;
        }
        break;
    case "moov":
    case "trak":
    case "mdia":
    case "dinf":
    case "iprp":
    case "ipco":
        isContainer = true;
        break;
    }
    if (data !== null) {
        tr1.children[1].innerHTML = data;
    }
    if (isContainer) {
        mp4view(arrbuf, boxType, offset, boxOffset + boxLength, maxCount, tr1.children[2], template);
    }
    return table;
}

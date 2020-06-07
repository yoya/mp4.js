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
    let uniq_count = 0;
    const uniq_maxCount = 4;
    let omit_count = 0;
    let prev_omitKey = null;
    while (offset < byteLength) {
        const realLength= dataview.getUint32(offset, false); // big-endian
        const boxLength = (realLength >= 8)? realLength: byteLength - offset;
        let table = mp4box(arrbuf, parentType, offset, boxLength, realLength,
                           template);
        if ((table.omitKey !== null) && (table.omitKey === prev_omitKey)) {
            uniq_count ++;
        } else {
            uniq_count = 1;
        }
        const last = (byteLength <= (offset + boxLength)) || (count >= maxCount);
        const viewOmit = (omit_count > 0) && ((uniq_count === 1) || last);
        (omit_count > 0) && ((uniq_count === 1) || last);
        if (viewOmit) {
            const t = document.createElement("table");
            const t_tr = document.createElement("tr");
            const t_td = document.createElement("td");
            t_td.innerHTML = "(omit..."+omit_count+")";
            t.append(t_tr);
            t_tr.append(t_td);
            t.style = "border:0 ; padding:2ex;";
            container.append(t);
            omit_count = 0;
        }
        if (count > maxCount) {
            console.warn("container box count limit");
            break;
        }
        if ((uniq_count <  uniq_maxCount) || last) {
            container.append(table);
            omit_count = 0;
        } else {
            omit_count ++;
        }
        offset += boxLength;
        prev_omitKey = table.omitKey;
        count++;
    }
}

function mp4box(arrbuf, parentType, boxOffset, boxLength, realLength,
                template) {
    let maxCount = 10000;
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
    tr1.children[0].innerHTML = boxType;
    //
    const dataview = new DataView(arrbuf);
    let offset = boxOffset + 8;
    let data = null;
    let isContainer = false;
    table.omitKey = null;
    table.boxType = boxType; // XXX
    switch (boxType) {
        /**** **** **** **** **** **** **** ****
         *         no container box
         **** **** **** **** **** **** **** ****/
    case "ftyp":
        {
            let brandBytes = arr.subarray(offset, offset + 4);
            let brand = String.fromCharCode.apply("", brandBytes);
            const minorVersion = dataview.getUint32(offset + 4, false);
            data = "brand:"+brand + ", "+minorVersion;
            offset += 8;
            while (offset < boxOffset + boxLength) {
                brandBytes = arr.subarray(offset, offset + 4);
                brand = String.fromCharCode.apply("", brandBytes);
                data += ", "+brand;
                offset += 4;
            }
        }
        break;
    case "hdlr":
        {
            // const tmp = dataview.getUint32(offset, false);
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            const comptypeBytes = arr.subarray(offset + 4, offset + 8);
            const subtypeBytes = arr.subarray(offset + 8, offset + 12);
            const comptype = String.fromCharCode.apply("", comptypeBytes);
            const subtype  = String.fromCharCode.apply("", subtypeBytes);
            data = // "version:"+version + " flags:"+flags +
                "type:" + comptype + " subtype:" + subtype;
            table.omitKey = comptype+":"+subtype;
        }
        break;
    case "pitm":
        {
            // const tmp = dataview.getUint32(offset, false);
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            const itemId = dataview.getUint16(offset + 4, false);
            data = //"version:"+version + " flags:"+flags +
                "itemId:"+itemId;
        }
        break;
    case "iloc":
        if (parentType === "iref") {
            console.warn(parentType+"=>iloc box not implemented yet.")
        } else {
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
            data = // "version:"+version + " flags:"+flags +
                "count:"+itemCount;
            offset += 8;
            /*
            for (let i = 0 ; i < itemCount ; i++) {
                let itemId = dataview.getUint16(offset);
                console.log("itemId:"+itemId);
            }
            */
        }
        break;
    case "url ":
        {
            // const tmp = dataview.getUint32(offset, false);
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            const locationBytes = arr.subarray(offset + 4, boxOffset + boxLength);
            const location = String.fromCharCode.apply("", locationBytes);
            data = // "version:"+version + " flags:"+flags +
                "location:"+location;
        }
        break;
    case "thmb":
    case "cdsc":
    case "dimg":
    case "auxl":
        {
            const fromItemId = dataview.getUint16(offset);
            const itemCount = dataview.getUint16(offset + 2);
            data = "fromId:"+ fromItemId + " count:"+itemCount + " itemIds:";
            offset += 4;
            for (let i = 0 ; i < itemCount ; i++) {
                if (i >= 4) { // max 4
                    data += " (omit..."+(itemCount - i)+")";;
                    break;
                }
                if (i > 0) {
                    data += ",";
                }
                let itemId = dataview.getUint16(offset);
                data += itemId;
                offset += 2;
            }
        }
        break;
    case "infe":
        {
            const tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            let itemId = dataview.getUint16(offset + 4);
            let protectIndex = dataview.getUint16(offset + 6);
            offset += 8;
            let itemType = "";
            if (version) {
                const itemTypeBytes = arr.subarray(offset, offset + 4);
                itemType = String.fromCharCode.apply("", itemTypeBytes);
                offset += 4;
            } else {
                table.omitKey = "";
            }
            const lastIndex = arr.indexOf(0, offset);
            let itemName = "";
            if (lastIndex >= 0) {
                const itemNameBytes = arr.subarray(offset, lastIndex);
                itemName = String.fromCharCode.apply("", itemNameBytes);
            } else {
                console.warn("not fount null terminator for infe itemName");
            }
            data = "itemId:"+itemId;
            if (protectIndex > 0) {
                data += " protectIndex:"+protectIndex;
            }
            data += " type:"+itemType;
            if (itemName !== "") {
                data += " name:"+itemName;
            }
            table.omitKey = protectIndex+":"+itemType+":"+itemName;
        }
        break;
    case "ispe":
        {
            // const tmp = dataview.getUint32(offset, false);
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            const width  = dataview.getUint32(offset+4, false);
            const height = dataview.getUint32(offset+8, false);
            data = // "version:"+version + " flags:"+flags +
                "width:"+width + " height:"+height;
        }
        break;
    case "colr":
        {
            const subtypeBytes = arr.subarray(offset, offset+4);
            const subtype = String.fromCharCode.apply("", subtypeBytes);
            data = "subtype:"+subtype;
        }
        break;
    case "pixi":
        {
            // const tmp = dataview.getUint32(offset, false);
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            const count = arr[offset+4]
            offset += 5;
            data = "bits:"
            for (let i = 0 ; i < count ; i++) {
                if (i > 0) {
                    data += ",";
                }
                data += arr[offset++];
            }
        }
        break;
    case "clap":
        {
            const width_N    = dataview.getUint32(offset     , false);
            const width_D    = dataview.getUint32(offset + 4 , false);
            const height_N   = dataview.getUint32(offset + 8 , false);
            const height_D   = dataview.getUint32(offset + 12, false);
            const horiOff_N = dataview.getUint32(offset + 16, false);
            const horiOff_D = dataview.getUint32(offset + 20, false);
            const vertOff_N  = dataview.getUint32(offset + 24, false);
            const vertOFF_D  = dataview.getUint32(offset + 28, false);
            data = "width:"+width_N+"/"+width_D +
                " height:"+height_N+"/"+height_D +
                " horiOff:"+horiOff_N+"/"+horizOff_D +
                " vertOff:"+vertOff_N+"/"+vertOff_D;
        }
        break;
    case "irot":
        {
            const tmp = arr[offset]
            // |  6bits     | 2bits |
            // |  reserved  | angle |
            const angle = tmp & 0x3;
            data = "angle:"+angle;
        }
        break;
    case "ipma":
        {
            const tmp = dataview.getUint32(offset, false);
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const entryCount = dataview.getUint32(offset+4, false);
            offset += 8;
            data = "count:"+entryCount+" [";
            for (let i = 0; i < entryCount ; i++) {
                if (i >= 4) { // max 4
                    data += " (omit..."+(entryCount - i)+")";;
                    break;
                }
                const itemId = dataview.getUint16(offset, false);
                offset += 2;
                const assocCount = arr[offset++];
                if (i > 0) {
                    data += " ";
                }
                data += "{itemId:"+itemId+" assoc:[";
                for (let j = 0; j < assocCount ; j++) {
                    let tmp = arr[offset++];
                    const essential = tmp >> 7;
                    if (flags & 1)  {
                        tmp = (tmp * 0x100) + arr[offset ++];
                    }
                    const propertyIndex = tmp;
                    if (j > 0) {
                        data+" ";
                    }
                    data += "{essen:"+essential+" propIndex:"+propertyIndex+"}";
                }
                data += "]}";
            }
            data += "]";
        }
        break;
        /**** **** **** **** **** **** **** ****
         *           container box
         **** **** **** **** **** **** **** ****/
    case "meta":
    case "iref":
        {
            const tmp = dataview.getUint32(offset, false);
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            // data = "version:"+version + " flags:"+flags;
            offset += 4;
            isContainer = true;
        }
        break;
    case "dref":
        {
            // const tmp = dataview.getUint32(offset, false);
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            const count = dataview.getUint32(offset + 4, false);
            offset += 8;
            data = // "version:"+version + " flags:"+flags +
                "count:"+count;
            maxCount = count;
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
            data = // "version:"+version + " flags:"+flags +
                "count:"+count;
            maxCount = count;
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
        // console.debug("isContainer", boxType, maxCount);
        mp4view(arrbuf, boxType, offset, boxOffset + boxLength,
                maxCount, tr1.children[2], template);
    }
    return table;
}

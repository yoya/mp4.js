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

function toHexNumber(v, d){
    let h = v.toString(16).toUpperCase();
    if (h.length < d) {
        h = '0'.repeat(d - h.length) + h;
    }
    return h;
}

function mp4view(arrbuf, parentType, byteOffset, byteLength, maxCount, container, template) {
    const reader = new ByteReader(arrbuf, byteOffset, false);
    let count = 0;
    let uniq_count = 0;
    const uniq_maxCount = 4;
    let omit_count = 0;
    let prev_omitKey = null;
    let offset = byteOffset;
    while (offset < byteLength) {
        reader.setOffset(offset);
        const realLength= reader.getUint32();
        let boxLength = realLength;
        if (realLength == 1) {
            boxLength = reader.getUint64();
        }
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

const ProfileIdcDescTable = ["Unknown profile", "Main profile", "Main 10 profile", "Main still Picture profile", "Format range extentions"];
const ChromaDescTable = ["Grayscale", "YUV420", "YUV422", "YUV444"];

function mp4box(arrbuf, parentType, boxOffset, boxLength, realLength,
                template) {
    let maxCount = 10000;
    const reader = new ByteReader(arrbuf, boxOffset + 4, false);
    let boxType = reader.getString(4);
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
            let brand = reader.getString(4);
            const minorVersion = reader.getUint32();
            data = "brand:"+brand + ", "+minorVersion;
            let offset = reader.getOffset();
            while (offset < boxOffset + boxLength) {
                brand = reader.getString(4)
                data += ", "+brand;
                offset += 4;
            }
        }
        break;
    case "hdlr":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const comptype = reader.getString(4);
            const subtype  = reader.getString(4);
            data = // "version:"+version + " flags:"+flags +
                "type:" + comptype + " subtype:" + subtype;
            table.omitKey = comptype+":"+subtype;
        }
        break;
    case "pitm":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const itemId = reader.getUint16();
            data = //"version:"+version + " flags:"+flags +
                "itemId:"+itemId;
        }
        break;
    case "iloc":
        if (parentType === "iref") {
            console.warn(parentType+"=>iloc box not implemented yet.")
        } else {
            let tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            // |   4 bits   |   4 bits   |     4 bits     |   4 bits  |
            // | offsetSize | lengthSize | baseOffsetSize | indexSize |
            tmp = reader.getUint16();
            const offsetSize     = (tmp >> 12) & 0xF;
            const lengthSize     = (tmp >>  8) & 0xF;
            const baseOffsetSize = (tmp >>  4) & 0xF;
            const indexSize = (version==0)? null: ((tmp >>  0) & 0xF);
            const itemCount = reader.getUint16()
            data = // "version:"+version + " flags:"+flags +
                "count:"+itemCount+" [";
            for (let i = 0; i < itemCount; i++) {
                data += "{";
                const itemId = reader.getUint16();
                data += "itemId:"+itemId;
                if (version >= 1) {
                    const constructionMethod = reader.getUint16()
                    data += " method:"+constructionMethod;
                }
                const dataReferenceIndex = reader.getUint16();
                data += " drefindex:"+dataReferenceIndex;
                let baseOffset = reader.getUintN(baseOffsetSize);
                const entryCount = reader.getUint16();
                data += " [";
                for (let j = 0; j < entryCount; j++) {
                    data += "{";
                    let extendOffset = reader.getUintN(offsetSize);
                    data += "offset:"+(baseOffset+extendOffset);
                    if (version >= 1) {
                        let extentIndex = reader.getUintN(indexSize);
                        data += " extentIndex:"+extentIndex
                    }
                    let extentLength = reader.getUintN(lengthSize);
                    data += " length:"+extentLength;
                    data += "}";
                }
                data += "]}";
                if (i >= 4) { // max 4
                    data += " (omit..."+(itemCount - i)+")";;
                    break;
                }

            }
            data += "]";
        }
        break;
    case "url ":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const location = reader.getString(4);
            data = // "version:"+version + " flags:"+flags +
                "location:"+location;
        }
        break;
    case "thmb":
    case "cdsc":
    case "dimg":
    case "auxl":
        {
            const fromItemId = reader.getUint16();
            const itemCount = reader.getUint16();
            data = "fromId:"+ fromItemId + " count:"+itemCount + " itemIds:";
            for (let i = 0 ; i < itemCount ; i++) {
                if (i >= 4) { // max 4
                    data += " (omit..."+(itemCount - i)+")";;
                    break;
                }
                if (i > 0) {
                    data += ",";
                }
                let itemId = reader.getUint16();
                data += itemId;
            }
        }
        break;
    case "infe":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            let itemId = reader.getUint16();
            let protectIndex = reader.getUint16();
            let itemType = "";
            if (version) {
                itemType = reader.getString(4);
            } else {
                table.omitKey = "";
            }
            let itemName = reader.getStringNullTerminate();
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
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const width  = reader.getUint32();
            const height = reader.getUint32();
            data = // "version:"+version + " flags:"+flags +
                "width:"+width + " height:"+height;
        }
        break;
    case "colr":
        {
            const subtype = reader.getString(4);
            data = "subtype:"+subtype;
        }
        break;
    case "pixi":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const count = reader.getUint8();
            data = "bits:"
            for (let i = 0 ; i < count ; i++) {
                if (i > 0) {
                    data += ",";
                }
                data += reader.getUint8();
            }
        }
        break;
    case "pasp":
        {
            const vspace = reader.getUint32();
            const hspace = reader.getUint32();
            data = "vspace:"+vspace + " hspace:"+hspace;

        }
        break;
    case "clap":
        {
            const width_N    = reader.getUint32();
            const width_D    = reader.getUint32();
            const height_N   = reader.getUint32();
            const height_D   = reader.getUint32();
            const horiOff_N  = reader.getUint32();
            const horiOff_D  = reader.getUint32();
            const vertOff_N  = reader.getUint32();
            const vertOFF_D  = reader.getUint32();
            data = "width:"+width_N+"/"+width_D +
                " height:"+height_N+"/"+height_D +
                " horiOff:"+horiOff_N+"/"+horizOff_D +
                " vertOff:"+vertOff_N+"/"+vertOff_D;
        }
        break;
    case "irot":
        {
            // |  6bits     | 2bits |
            // |  reserved  | angle |
            const angle = reader.getUint8() & 0x3;
            data = "angle:"+angle;
        }
        break;
    case "ipma":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const entryCount = reader.getUint32();
            data = "count:"+entryCount+" [";
            for (let i = 0; i < entryCount ; i++) {
                if (i >= 4) { // max 4
                    data += " (omit..."+(entryCount - i)+")";;
                    break;
                }
                const itemId = reader.getUint16();
                const assocCount = reader.getUint8();
                if (i > 0) {
                    data += " ";
                }
                data += "{itemId:"+itemId+" assoc:[";
                for (let j = 0; j < assocCount ; j++) {
                    let tmp = reader.getUint8();
                    const essential = tmp >> 7;
                    tmp &= 0x7F;
                    if (flags & 1)  {
                        tmp = (tmp << 8) + reader.getUint8();
                    }
                    const propertyIndex = tmp;
                    if (j > 0) {
                        data += " ";
                    }
                    data += "{essen:"+essential+" propIndex:"+propertyIndex+"}";
                }
                data += "]}";
            }
            data += "]";
        }
        break;
    case "hvcC":
        {
            const version = reader.getUint8();
            //  |   2   |  1 |     5     |
            //  | profs | tf |  procIdc  |
            const tmp = reader.getUint8();
            const profileSpace = tmp >> 6;
            const tierFlag     = (tmp >> 5) & 1;
            const profileIdc   = tmp & 0x1F;
            const profileCompatibilityFlags = reader.getUint32();
            const constraintIndicatorFlags  = reader.getUintN(6);  // 48bit
            const levelIdc = reader.getUint8();
            // |   4    |            12             |
            // |reserved| minSpatialSegmentationIdc |
            const minSpatialSegmentationIdc = reader.getUint16() & 0xFFF;
            // |       6       |   2   |
            // |   reserved    | pType |
            const parallelismType = reader.getUint8() & 0x3;
            // |       6       |   2   |
            // |   reserved    | chroma|
            const chromaFormat = reader.getUint8() & 0x3;
            // |       5     |    3    |
            // |   reserved  |  depth  |
            const bitDepthLumaMinus8 = reader.getUint8() & 0x7;
            // |       5     |    3    |
            // |   reserved  |  depth  |
            const bitDepthChromaMinus8 = reader.getUint8() & 0x7;
            const avgFrameRate = reader.getUint16();
            //
            data = // "version:"+version +
                "profileSpace:"+profileSpace + " tierFlag:"+tierFlag + " profileIdc:"+profileIdc;
            data += "("+ProfileIdcDescTable[profileIdc]+")";
            data += " compatibilityFlags:0x"+toHexNumber(profileCompatibilityFlags, 8);
            data += " constraintFlags:0x"+toHexNumber(constraintIndicatorFlags, 12);
            data += " levelIdc:"+levelIdc + " chroma:"+chromaFormat;
            data += "("+ChromaDescTable[chromaFormat]+")";
            data += " bitDepth:("+(bitDepthLumaMinus8+8);
            data += ","+(bitDepthChromaMinus8+8)+")";
        }
        break;
    case "av1C":
        {
            const tmp1 = reader.getUint8();
            const marker = (tmp1 >> 7), version = tmp1 & 0x7F;
            // | 3  |    5     |
            // | sp |  slidx   |
            const tmp2 = reader.getUint8();
            const seq_profile = (tmp2 >> 5), seq_level_idx_0 = tmp2 & 0x1F;
            // |  1 |  1 |  1 |  1 |  1 |  1 |   2   |
            // | st | hq | tb | mc | cx | cy |   cp  |
            const tmp3 = reader.getUint8();
            const seq_tier_0             =  tmp3 >> 7;
            const high_bitdepth          = (tmp3 >> 6) & 1;
            const twelve_bit             = (tmp3 >> 5) & 1;
            const monochrome             = (tmp3 >> 4) & 1;
            const chroma_subsampling_x   = (tmp3 >> 3) & 1;
            const chroma_subsampling_y   = (tmp3 >> 2) & 1;
            const chroma_sample_position =  tmp3 & 3;
            data = "marker:"+marker + " version:"+version +
                " profile:"+seq_profile + " level_idx_0:"+seq_level_idx_0 +
                " tier_0:"+seq_tier_0 + "high_bitdepth:"+high_bitdepth +
                " twelve_bit:"+twelve_bit + " monochrome:"+monochrome +
                " subsampling_x:"+chroma_subsampling_x +
                " subsampling_y:"+chroma_subsampling_y +
                "chroma_sample_position:"+chroma_sample_position;
        }
        break;
        /**** **** **** **** **** **** **** ****
         *           container box
         **** **** **** **** **** **** **** ****/
    case "meta":
    case "iref":
        {
            const tmp = reader.getUint32();
            // const version = tmp >> 24, flags = tmp & 0xffffff;
            // data = "version:"+version + " flags:"+flags;
            isContainer = true;
        }
        break;
    case "dref":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            const count = reader.getUint32();
            data = // "version:"+version + " flags:"+flags +
                "count:"+count;
            maxCount = count;
            isContainer = true;
        }
        break;
    case "iinf":
        {
            const tmp = reader.getUint32();
            const version = tmp >> 24, flags = tmp & 0xffffff;
            let count;
            if (version <= 1) {
                count = reader.getUint16();
            } else {
                count = reader.getUint32();
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
        const offset = reader.getOffset();
        mp4view(arrbuf, boxType, offset, boxOffset + boxLength,
                maxCount, tr1.children[2], template);
    }
    return table;
}

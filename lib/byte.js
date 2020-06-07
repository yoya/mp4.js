"use strict";

class ByteReader {
    // arrbuf: arraybuffer
    // offset: read start offset
    // endian: false:big-endian, true:little-endian
    constructor(arrbuf, offset, endian) {
        this.uint8arr = new Uint8Array(arrbuf);
        this.dataview = new DataView(arrbuf);
        this.offset = offset;
        this.endian = endian;
    }
    getUint8() {
       return this.uint8arr[this.offset++]; 
    }
    getUint16() {
        const v = this.dataview.getUint16(this.offset, this.endian);
        this.offset += 2;
        return v;
    }
    getUint32() {
        const v = this.dataview.getUint32(this.offset, this.endian);
        this.offset += 4;
        return v;
    }
    getUintN(n) {
        let v = 0;
        for (let i = 0; i < n; i++) {
            v = (v << 8) + this.uint8arr[this.offset++];
        }
        return v;
    }
    getString(n) {
        let bytes = arr.subarray(this.offset, this.offset + n);
        this.offset += n;
        return String.fromCharCode.apply("", bytes);
    }
    getStringNullTerminate(n) {
        const nullIndex = arr.indexOf(0, this.offset);
        if (nullIndex < 0) {
            throw "Not found null termination offset:"+this.offset;
        }
        this.offset += nullIndex - this.offset + 1;
        return arr.subarray(this.offset, lastIndex);
    }
}}

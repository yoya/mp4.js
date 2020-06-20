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
    getOffset() { return this.offset; }
    setOffset(offset) { this.offset = offset; }
    incrOffset(offset) { this.offset += offset; }
    //
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
    getUint64() {
        return (this.getUint32() << 32) + this.getUint32();
    }
    getUintN(n) {
        let v = 0;
        if (this.endian) {  // little-endian
            for (let i = 0; i < n; i++) {
                v += this.uint8arr[this.offset++] << (i*8);
            }
        } else {            // big-endian
            for (let i = 0; i < n; i++) {
                v = (v << 8) + this.uint8arr[this.offset++];
            }
        }
        return v;
    }
    getString(n) {
        const bytes = this.uint8arr.subarray(this.offset, this.offset + n);
        this.offset += n;
        return String.fromCharCode.apply("", bytes);
    }
    getStringNullTerminate() {
        const nullIndex = this.uint8arr.indexOf(0, this.offset);
        if (nullIndex < 0) {
            throw "Not found null termination offset:"+this.offset;
        }
        const n = nullIndex - this.offset;
        const bytes = this.uint8arr.subarray(this.offset, this.offset + n);
        this.offset += n + 1;
        return String.fromCharCode.apply("", bytes);
    }
}

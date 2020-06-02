"use strict";

function dropFunction(target, func, dataType) {
    var cancelEvent = function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
    target.addEventListener("dragover" , cancelEvent, false);
    target.addEventListener("dragenter", cancelEvent, false);
    target.addEventListener("drop"     , function(e) {
        e.preventDefault();
        e.stopPropagation();
        var file = e.dataTransfer.files[0];
        if (file) {
            var reader = new FileReader();
            reader.onload = function(e) {
                let data = e.target.result;
                if (dataType === "Uint8Array") {
                    data = new Uint8Array(data);
                }
                func(data);
            }
            switch (dataType) {
            case "ArrayBuffer":
            case "Uint8Array":
                reader.readAsArrayBuffer(file);
                break;
            case "DataURL":
                reader.readAsDataURL(file);
                break;
            default:
                console.error("Wrong read type:"+dataType);
                break;
            }
        }
    }, false);
}

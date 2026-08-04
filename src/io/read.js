// read.js — transport-level file reading. Headless, format-agnostic.
//
// Extracted from io/fileUpload.js, which mixed these with upload UI. They answer "get the bytes /
// the DOM out of this file", not "what should the app do next", so they stay in the engine while
// the upload controllers move to the app tier.
//
// Distinct from io/parse.js: parse.js turns a source into a Dataset (a model). These return raw
// material — an XML Document, parsed JSON, a data URL — for callers that need the intermediate.

import JSZip from "jszip";

const getDom = (xml) => new DOMParser().parseFromString(xml, "text/xml");
const getExtension = (fileName) => String(fileName).split(".").pop();

/**
 * KMZ (a zipped KML) → the KML XML Document of its first .kml entry.
 * Rejects when the archive holds no .kml.
 */
export const getKmlDom = (kmzFile) => {
  const zip = new JSZip();
  return zip.loadAsync(kmzFile).then((zip) => {
    let kmlDom = null;
    zip.forEach((relPath, file) => {
      if (getExtension(relPath) === "kml" && kmlDom === null) {
        kmlDom = file.async("string").then(getDom);
      }
    });
    return kmlDom || Promise.reject("No kml file found");
  });
};

/** Read a File as text and JSON.parse it. Rejects on invalid JSON. */
export function readFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const fileContent = event.target.result;
      try {
        resolve(JSON.parse(fileContent));
      } catch (error) {
        console.error("Error parsing JSON:", error);
        reject(error);
      }
    };
    reader.readAsText(file);
  });
}

/** Read a File as a data: URL. (Named for the FileReader method; callers treat it as bytes.) */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error("Failed to read file", e));
    reader.readAsDataURL(file);
  });
}

import Vision
import AppKit

let path = CommandLine.arguments[1]
guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("ERR: cannot load image"); exit(1)
}
let req = VNRecognizeTextRequest { r, e in
    guard let obs = r.results as? [VNRecognizedTextObservation] else { return }
    for o in obs {
        if let t = o.topCandidates(1).first {
            print(t.string)
        }
    }
}
req.recognitionLevel = .accurate
req.recognitionLanguages = ["zh-Hans", "en-US"]
req.usesLanguageCorrection = true
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try? handler.perform([req])

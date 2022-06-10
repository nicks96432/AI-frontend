import { useRef, useState, useReducer } from "react";
import type { ChangeEventHandler } from "react";
import RecordRTC from "recordrtc";

import ProgressBar from "./components/ProgressBar";
import Form, { formReducer } from "./components/Form";
import "./App.css";

const App = () => {
  const [stage, setStage] = useState<number>(0);
  const [coughProgress, setProgress] = useState(0);
  const [recording, setRecording] = useState(false);
  const [hideUI, setHideUI] = useState(false);
  const [hideSubmit, setHideSubmit] = useState(true);
  const [showThanks, setShowThanks] = useState(false);

  const [payload, dispatchPayload] = useReducer(formReducer, null);

  const blobListRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleRecord = async () => {
    if (!navigator.mediaDevices) {
      console.error("media API not supported");
      return;
    }

    const recorderOptions: RecordRTC.Options = {
      disableLogs: true,
      mimeType: "audio/wav",
      numberOfAudioChannels: 1,
      sampleRate: 16000,
      recorderType: RecordRTC.StereoAudioRecorder,
      timeSlice: 1000,
      type: "audio"
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error("cannot access microphone, please upload file instead");
      return;
    }
    const recorder = new RecordRTC(stream, recorderOptions);

    setRecording(true);
    recorder.startRecording();

    for (let i = 1; i <= 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      setProgress(i * 5);
    }

    recorder.stopRecording(() => {
      const blob = recorder.getBlob();
      blobListRef.current.push(blob);
      setStage(s => {
        // next stage is 4, which is time to show the checkbox
        if (stage === 3) dispatchPayload({ type: "reset" });
        return s + 1;
      });
      setRecording(false);
      setHideSubmit(false);
      setHideUI(true);
      recorder.destroy();
    });
  };

  const handleUpload: ChangeEventHandler<HTMLInputElement> = e => {
    const filelist = e.target.files;
    if (filelist === null) return;
    const file = filelist[0];
    if (!file.type.match(/audio\/(x-)?wav/)) {
      console.error(file.type, "is not an wav file");
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const data = e.target!.result;
      if (data === null) return;

      const blob = new Blob([data], { type: file.type });
      blobListRef.current.push(blob);
      setStage(s => {
        // next stage is 4, which is time to show the checkbox
        if (stage === 3) dispatchPayload({ type: "reset" });
        return s + 1;
      });
      setProgress(100);
      setHideSubmit(false);
      setHideUI(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (process.env.REACT_APP_API_URL === undefined) {
      console.error("REACT_APP_API_URL is not defined");
      return;
    }

    if (stage === 0) return;
    if (stage < 4) {
      setHideUI(false);
      setHideSubmit(true);
      setProgress(0);
      return;
    }

    // this should not happen, but just in case
    if (payload === null) {
      return;
    }

    const formData = new FormData();
    formData.append("soft_cough", blobListRef.current[0]);
    formData.append("heavy_cough", blobListRef.current[1]);
    formData.append("soft_breath", blobListRef.current[2]);
    formData.append("heavy_breath", blobListRef.current[3]);
    formData.append("form", JSON.stringify(payload));
    console.log(formData);
    const response = await fetch(process.env.REACT_APP_API_URL, {
      body: formData,
      method: "POST",
      mode: "cors"
    });
    if (!response.ok) {
      console.error(response);
      return;
    }
    console.log(response);
    setShowThanks(true);
  };

  return (
    <div className="App">
      <header className="App__header">
        {showThanks ? (
          <div>Thank you for your submission!</div>
        ) : (
          <>
            <div className="App__title">Frontend Title</div>
            <ProgressBar completed={coughProgress} />
            {payload === null ? null : (
              <Form payload={payload} dispatchPayload={dispatchPayload} />
            )}
            <div className="App__buttons">
              {hideUI ? null : (
                <>
                  <button
                    className="App__button"
                    disabled={recording}
                    onClick={handleRecord}
                  >
                    {recording ? "recording..." : "record"}
                  </button>
                  <button
                    className="App__button"
                    onClick={() => fileRef.current?.click()}
                  >
                    upload <sup>*</sup>
                  </button>
                </>
              )}
              {hideSubmit ? null : (
                <button className="App__button" onClick={handleSubmit}>
                  {payload === null ? "next" : "submit"}
                </button>
              )}
              <input
                type="file"
                ref={fileRef}
                hidden={true}
                onChange={handleUpload}
              />
            </div>
            {hideUI ? null : (
              <div className="App__comment">
                <sup>*</sup> currently supports wav only
              </div>
            )}
          </>
        )}
      </header>
    </div>
  );
};

export default App;

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type MediaElementId = number;

export interface MediaElement {
  id: MediaElementId;
  updateStreamFn?: (stream: MediaStream) => void;
  subject: BehaviorSubject<MediaStream>;
}

@Injectable({
  providedIn: 'root'
})

export class MediaService {
  private index = 0;
  private mediaStreamListBs: MediaElement[] = [];

  addMediaStream(media?: MediaStream | undefined  ): MediaElementId {
    const newMedia = media || new MediaStream();
    const mediaBs = new BehaviorSubject(newMedia);
    const mediaElement: MediaElement = {
      id: this.index,
      subject: mediaBs,
    };
    this.index++;
    console.log('[MediaService] index: ', this.index)
    this.mediaStreamListBs.push(mediaElement);
    return mediaElement.id;
  }

  getMediaStream(id: MediaElementId): Observable<MediaStream> {
    const mediaElement = this.mediaStreamListBs.find(element => element.id == id);
    if (!mediaElement) {
      throw new Error('Invalid MediaElementId');
    }
    return mediaElement.subject.asObservable();
  }


  getStream(id: MediaElementId): MediaStream {
    const mediaElement = this.mediaStreamListBs.find(element => element.id == id);
    if (!mediaElement) {
      throw new Error('Invalid MediaElementId');
    }
    return mediaElement.subject.getValue()
  }

  setMediaStream(id: MediaElementId, stream: MediaStream): void {
    const mediaElement = this.mediaStreamListBs.find(element => element.id == id);
    if (!mediaElement) {
      throw new Error('Invalid MediaElementId');
    }
    console.log('mediaElement ', mediaElement)
    if (mediaElement.updateStreamFn) {
      mediaElement.updateStreamFn(stream);
      console.log('SETMEDIASTREAM updateStreamFn - remoteId - mediaStream: ',stream)
    }
    mediaElement.subject.next(stream);
    console.log('SETMEDIASTREAM subject.next - remoteId - mediaStream: ',stream.getVideoTracks())
  }
  createNewStream( track: MediaStreamTrack): MediaElementId{
    var tracklist: MediaStreamTrack[] = [];
    tracklist.push(track)
    console.log('TRACKLIST - CREATENEWSTREAM: ', tracklist)
    const media = new MediaStream(tracklist)
    const mediaBs = new BehaviorSubject(media);
    const mediaElement: MediaElement = {
      id: this.index,
      subject: mediaBs,
    };
    this.index++;
    console.log('[MediaService] index: ', this.index)
    this.mediaStreamListBs.push(mediaElement);
    return mediaElement.id;
  }
}


import { CompileShallowModuleMetadata } from '@angular/compiler';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { MediaElementId, MediaService } from './media.service';
@Injectable({
  providedIn: 'root'
})

export class ConferenceService {

  private socket!: Socket;
  private pc!: RTCPeerConnection;

  private localMediaId!: MediaElementId;
  private localMediaId2!: MediaElementId;
  

  localMediaStream$!: Observable<MediaStream>;
  localMediaStream2$!: Observable<MediaStream>;
  
  private remoteMediaStreams$: Observable<MediaStream>[] = [];
  private remoteIds: MediaElementId[] = new Array()

  remotes = new Subject<Observable<MediaStream>>();

  idTracks :{ [id: string]: MediaStream } = {};

  constructor(private mediaService: MediaService) { 
    this.socket = io('http://localhost:8080');
    this.localMediaId = this.mediaService.addMediaStream();
    this.localMediaId2 = this.mediaService.addMediaStream();
    this.localMediaStream$ = this.mediaService.getMediaStream(this.localMediaId);
    this.localMediaStream2$ = this.mediaService.getMediaStream(this.localMediaId2);
  }

  private getPc(): RTCPeerConnection {
    return this.pc
  }
  
  getPeerConnection(): RTCPeerConnection{
    return this.getPc()
  }

  private getLocalId(): MediaElementId{
    return this.localMediaId
  }

  getLocalMediaId() : MediaElementId {
    return this.getLocalId();
  }

  private getLocalObservable(): Observable<MediaStream> {
    return this.localMediaStream$
  }
  private getLocalObservable2(): Observable<MediaStream> {
    return this.localMediaStream2$
  }
  getlocalMediaStream$(): Observable<MediaStream> {
    return this.getLocalObservable()
  }
  getlocalMediaStream2$(): Observable<MediaStream> {
    return this.getLocalObservable2()
  }

  setLocalMediaStream(stream:MediaStream) {
    this.mediaService.setMediaStream(this.localMediaId,stream)
  }

  setLocalMediaStream2(stream:MediaStream) {
    this.mediaService.setMediaStream(this.localMediaId2,stream)
  }

  setPeerConnection() {
    this.pc = this.createPeerConnection();
  }
  // CONNECTION //
  createPeerConnection(): RTCPeerConnection {
    var config: any = {
        sdpSemantics: 'unified-plan'
    };

    const pc = new RTCPeerConnection(config);
    pc.addEventListener('icegatheringstatechange', function() {
      (document.getElementById('ice-gathering-state') as any).textContent += ' -> ' + pc.iceGatheringState;
    }, false);
    (document.getElementById('ice-gathering-state') as any).textContent = pc.iceGatheringState;

    pc.addEventListener('iceconnectionstatechange', function() {
      (document.getElementById('ice-connection-state') as any).textContent += ' -> ' + pc.iceConnectionState;
    }, false);
    (document.getElementById('ice-connection-state') as any).textContent = pc.iceConnectionState;
  
    pc.addEventListener('signalingstatechange', function() {
      (document.getElementById('signaling-state') as any).textContent += ' -> ' + pc.signalingState;
    }, false);
    (document.getElementById('signaling-state') as any).textContent = pc.signalingState;

    // connect audio / video     
      pc.addEventListener('track', (evt) => {
        const track = evt.track
        const streams = evt.streams[0]

        console.log(evt.track)
        console.log(evt.streams[0].getTracks())
          
        if (evt.track.kind == 'video') {
          console.log('-------------- TRACK RECEIVED FROM THE SERVER ------------')
          var trackslist: MediaStreamTrack[] = []
          trackslist.push(evt.track)
          const remoteId = this.mediaService.createNewStream(evt.track)
      
          const remoteMediaStream$ = this.mediaService.getMediaStream(remoteId);
          this.remoteIds.push(remoteId);
          this.remoteMediaStreams$.push(remoteMediaStream$);
          this.remotes.next(remoteMediaStream$);
          console.group('INFO REMOTES')
          console.log('info remoteIds', this.remoteIds)
          console.log('info remoteMediaStreams$',this.remoteMediaStreams$)
          console.log('info remote')
          //Encontrar un track que esté stoppeado
          // const videoTracks = []
          // for(let t in this.mediaService.getStream(remoteId).getVideoTracks()){
          //   videoTracks.push(t)
          // }
          console.log('RECEIVERS ',this.pc.getReceivers());

          // const receivers: any[] = [];
          // for (let r in this.pc.getReceivers()){
          //     receivers.push();
          // }
         

          // console.log('RECEIVERS ',this.pc.getReceivers());
          // this.mediaService.getStream(remoteId).getVideoTracks().find(track => track.readyState == "ended");
          // // trackElement!.enabled = false;
          // this.remotes.unsubscribe();
          // console.log('unsubscribe')

  
        }else{
            (document.getElementById('audio') as any).srcObject = evt.streams[0];
        }       
    });
      
    return pc;
  }
  
  async negotiate() {
    // this.pc.addTransceiver('video', {direction: 'sendrecv'});
    // this.pc.addTransceiver('audio', {direction: 'sendrecv'});
    return this.pc.createOffer().then((offer) => {
      return this.pc.setLocalDescription(offer);
    }).then(() => {
      // wait for ICE gathering to complete
      return new Promise<void>((resolve) => {
        if (this.pc.iceGatheringState === 'complete') {
          resolve();
          
        } else {
          const pcCopy = this.pc;
          function checkState() {
            if (pcCopy.iceGatheringState === 'complete') {
              pcCopy.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          }
          this.pc.addEventListener('icegatheringstatechange', checkState);
        }
      });
      
    }).then(() => {
      var offer = this.pc.localDescription as RTCSessionDescription;
      var codec;
      
      codec = (document.getElementById('audio-codec') as any).value;
      
      console.log('[PlayerService] createOffer: enviado start-call')
      //Add things to pc.localDescription
      var video_transform = (document.getElementById('video-transform')as any).value
      console.log('video_transform   ',video_transform)
      this.socket.emit('video-transform', video_transform);
      this.socket.emit('start-call', this.pc.localDescription);
      
      (document.getElementById('offer-sdp') as any).textContent = offer.sdp;
      
    }).then(() =>{
      this.socket.on('call-started', (data) => {
        console.log('DATA call-started',data)
        if(this.pc.signalingState != 'stable') {
          
          console.log('[PlayerService] startCall: recibido call-started')
          let answerDescription = new RTCSessionDescription(data);
          
          this.pc.setRemoteDescription(answerDescription).then(() => {
            console.log('[PlayerService] startCall.setRemoteDescription')
          })
          console.log('TRACKKKKKK received - STOP RECEIVER ',data)
          this.pc.addEventListener('sender-stopped', (data)=>{
            console.log('RECEIVERS ',this.pc.getReceivers());
  
            const receivers: any[] = [];
            for (let r in this.pc.getReceivers()){
                receivers.push();
            }
            const trackId = receivers.find(track => track.id == "ended");
              this.remotes.unsubscribe();
        
          })
          }else{
                   
          }
        })
      }).catch((e) => {
          alert(e);
      });
  }

  sendVideoTransform(video_transform : String){
    this.socket.emit('video-transform',video_transform)
  }

  changeTrack(){
    this.socket.emit('change-track')
  }
  
}



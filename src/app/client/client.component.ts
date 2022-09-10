import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ConferenceService } from '../conference.service';

@Component({
  selector: 'app-client',
  templateUrl: './client.component.html',
  styleUrls: ['./client.component.css']
})
export class ClientComponent implements OnInit{

  localMediaStream$!: Observable<MediaStream>;
  localMediaStream2$!: Observable<MediaStream>;

  remoteMediaStreams: Observable<MediaStream>[] = [];

  constructor (private conferenceService: ConferenceService) {
  
  }

  ngOnInit(): void {
      this.localMediaStream$ = this.conferenceService.getlocalMediaStream$()
      this.localMediaStream2$ = this.conferenceService.getlocalMediaStream2$()

      this.conferenceService.remotes.subscribe(ms$ => this.remoteMediaStreams.push(ms$));
  }
  
  start() {
  
    var dataChannelLog = (document.getElementById('data-channel') as any);
    (document.getElementById('start') as any).style.display = 'none';
    this.conferenceService.setPeerConnection();

    var time_start: number | null = null;

    function current_stamp() {
        if (time_start === null) {
            time_start = new Date().getTime();
            return 0;
        } else {
            return new Date().getTime() - time_start;
        }
    }

    var constraints = {
        audio: (document.getElementById('use-audio') as any).checked,
        video: false
    };

    if ((document.getElementById('use-video') as any).checked) {
        var resolution = (document.getElementById('video-resolution') as any).value;
        if (resolution) {
            resolution = resolution.split('x');
            (constraints as any).video = {
                width: parseInt(resolution[0], 0),
                height: parseInt(resolution[1], 0)
            };
        } else {
            constraints.video = true;
        }
    }
           
    if (constraints.audio || constraints.video) {
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        this.conferenceService.setLocalMediaStream(stream);
        stream.getTracks().forEach((track) => {
            console.log('addTrack ------- client')
            this.conferenceService.getPeerConnection().addTrack(track, stream);
        });     
        
    }, function(err) {
        alert('Could not acquire media: ' + err);
    });
    // (document.getElementById('stop') as any).style.display = 'inline-block';
    // (document.getElementById('change') as any).style.display = 'inline-block';

    } else {

        console.log('No se ha seleccionado audio ni video')
    }

  }

  stop() {
    (document.getElementById('stop') as any).style.display = 'none';

    // close transceivers
    // if (this.conferenceService.getPeerConnection().getTransceivers) {
    //     this.conferenceService.getPeerConnection().getTransceivers().forEach(function(transceiver: any) {
    //         if (transceiver.stop) {
    //             transceiver.stop();
    //         }
    //     });
    // }

    // // close local audio / video
    this.conferenceService.getPeerConnection().getSenders().forEach(function(sender: any) {
        sender.track.stop();
    });

    // close peer connection
    // setTimeout(() => {
    //     this.conferenceService.getPeerConnection().close();
    // }, 500);
  }

  startNewTrack() {
      console.log('Enumerate devices: ',navigator.mediaDevices.enumerateDevices())
      navigator.mediaDevices.getUserMedia({
          video: {
            //   deviceId: '6JgIhAD12/0UF8QvqkcTkKKDuZCr0rggTp/OPK2RhuI='
            //   deviceId: '+lmks11QrGWfb5A+fVdHPwnqVHQtdMcNB+IXyamoyECY='
              deviceId: 'f58WJ0o7f5k//roCCx/o1m7269Lv75goD7p8FSKCveU='
            }
        }).then((stream1) => {
            this.conferenceService.setLocalMediaStream2(stream1);
            stream1.getTracks().forEach((track) => {
                console.log('addTrack -------CAM CLIENT')
                console.log(this.localMediaStream2$)
                this.conferenceService.getPeerConnection().addTrack(track, stream1);
            });
    
            this.conferenceService.negotiate();
        })
   }
  changeTrack(){
    this.conferenceService.changeTrack();
  }
 
}

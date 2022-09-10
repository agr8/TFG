import { Component, ElementRef, AfterViewInit, ViewChild, Input, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-video-player',
  templateUrl: './video-player.component.html',
  styleUrls: ['./video-player.component.css']
})
export class VideoPlayerComponent implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('video') video !: ElementRef;
  @Input('stream') stream: MediaStream | Observable<MediaStream | null> | null = null;

  subscription!: Subscription;
  isSubscribed = false;

  constructor() {

  }

  private subscribe(): void {
    if (this.isSubscribed || !this.stream) {
      return;
    }

    this.isSubscribed = true;

    if (this.stream instanceof MediaStream) {
      this.video.nativeElement.srcObject = this.stream;
    }
    else {
      this.subscription = this.stream
        .subscribe(stream => {
          this.video.nativeElement.srcObject = stream;
          // console.group('VideoPlayer');
          console.log('stream tras suscribirte: ', stream);
          console.log('tracks del stream tras suscribirte: ', stream?.getVideoTracks());

          // console.groupEnd();
        });
    }
  }
  private unsubscribe(): void {
    // if (this.isSubscribed || !this.stream) {
    //   return;
    // }

    this.isSubscribed = false;

    this.subscription.unsubscribe();
  }

  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.stream && changes.stream.currentValue && this.video) {
      this.subscribe();
    }
  }
  
  ngAfterViewInit(): void {
    this.subscribe();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

}

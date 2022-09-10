import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { ClientComponent } from './client/client.component';
import { RouterModule, Routes } from '@angular/router';
import { VideoPlayerComponent } from './video-player/video-player.component';

const routes: Routes = [
  // {path: '', component: AppComponent},
  {path: 'client', component: ClientComponent},
];
@NgModule({
  declarations: [
    AppComponent,
    ClientComponent,
    VideoPlayerComponent,
  ],
  imports: [
    BrowserModule,
    [RouterModule.forRoot(routes,
      //  {enableTracing: true}
    )]
  ],
  exports: [RouterModule, AppComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

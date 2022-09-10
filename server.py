import argparse
import asyncio
import json
import logging
import os
import ssl
import uuid
from asyncio import streams
from dataclasses import asdict
from time import sleep
from tokenize import String

# import aiohttp_cors
import aiortc
import av
import cv2
import socketio
from aiohttp import web
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import (MediaBlackhole, MediaPlayer, MediaRecorder,
                                  MediaRelay)
from av import VideoFrame
from av.frame import Frame

ROOT = os.path.dirname(__file__)

logger = logging.getLogger("pc")
pcs = set()
relay = MediaRelay()

videoTransform = "none"
videoObject = av.open('Cat.mp4')

sio = socketio.AsyncServer(async_mode='aiohttp', cors_allowed_origins="*")
app = web.Application()
sio.attach(app)


class VideoDeFicheroSinTrack(MediaStreamTrack):
    kind = 'video'

    def __init__(self, filename):
        super().__init__()
        self.filename = filename
        self.videoObject = av.open(filename)

    async def recv(self) -> Frame:

        # while True:
        # self.videoObject = av.open(self.filename)

        for packet in self.videoObject.demux():
            for frame in packet.decode():
                return frame

            raise asyncio.CancelledError


class VideoDeFichero(MediaStreamTrack):

    kind = "video"

    def __init__(self, videoObject, track):
        super().__init__()
        self.track = track
        self.videoObjecr = videoObject

    async def recv(self) -> Frame:
        frame = await self.track.recv()
        for packet in videoObject.demux():
            for frame in packet.decode():
                return frame


class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """

    kind = "video"

    def __init__(self, no_usar, track, transform):
        super().__init__()  # don't forget this!
        self.track = track
        self.transform = transform
        pathOut = f'newvideo{no_usar}.mp4'
        fps = 30
        size = (640, 480)
        self.out = cv2.VideoWriter(
            pathOut, cv2.VideoWriter_fourcc(*'mp4v'), fps, size)

    async def recv(self):
        frame = await self.track.recv()

        if self.transform == "cartoon":
            img = frame.to_ndarray(format="bgr24")

            # prepare color
            img_color = cv2.pyrDown(cv2.pyrDown(img))
            for _ in range(6):
                img_color = cv2.bilateralFilter(img_color, 9, 9, 7)
            img_color = cv2.pyrUp(cv2.pyrUp(img_color))

            # prepare edges
            img_edges = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
            img_edges = cv2.adaptiveThreshold(
                cv2.medianBlur(img_edges, 7),
                255,
                cv2.ADAPTIVE_THRESH_MEAN_C,
                cv2.THRESH_BINARY,
                9,
                2,
            )
            img_edges = cv2.cvtColor(img_edges, cv2.COLOR_GRAY2RGB)

            # combine color and edges
            img = cv2.bitwise_and(img_color, img_edges)

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "edges":
            # perform edge detection
            img = frame.to_ndarray(format="bgr24")
            img_w = img
            img = cv2.cvtColor(cv2.Canny(img, 100, 200), cv2.COLOR_GRAY2BGR)

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base

            height, width, layers = img.shape
            self.out.write(img_w)
            # return frame
            return new_frame
        elif self.transform == "rotate":
            # rotate image
            img = frame.to_ndarray(format="bgr24")
            rows, cols, _ = img.shape
            M = cv2.getRotationMatrix2D(
                (cols / 2, rows / 2), frame.time * 45, 1)
            img = cv2.warpAffine(img, M, (cols, rows))

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame
        elif self.transform == "graba":
            # rotate image
            img = frame.to_ndarray(format="bgr24")
            height, width, layers = img.shape
            self.out.write(img)
            return frame
        else:
            return frame


@sio.on('video-transform')
def video_transform(sid, data):
    global videoTransform
    videoTransform = data


cont = 0


@sio.on('start-call')
async def start_call(sid, data):

    offer = RTCSessionDescription(sdp=data["sdp"], type=data["type"])

    pc = RTCPeerConnection()
    pcs.add(pc)

    # prepare local media
    player = MediaPlayer(os.path.join(ROOT, "demo-instruct.wav"))

    @pc.on("datachannel")
    def on_datachannel(channel):
        @channel.on("message")
        def on_message(message):
            if isinstance(message, str) and message.startswith("ping"):
                channel.send("pong" + message[4:])

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print("Connection state is %s", pc.connectionState)
        if pc.connectionState == "failed":
            await pc.close()
            pcs.discard(pc)
        # elif pc.connectionState == "connected":
        #     pc.addTrack(VideoDeFichero('Cat.mp4'))

            # # negotiate
            # # handle offer
            # await pc.setRemoteDescription(offer)

            # # send answer
            # answer = await pc.createAnswer()
            # await pc.setLocalDescription(answer)

            # await sio.emit('call-started', data=asdict(pc.localDescription), to=sid)

    @pc.on("track")
    def on_track(track):

        if track.kind == "audio":
            pc.addTrack(player.audio)
        elif track.kind == "video":

            global cont
            cont += 1
            global s1 
            s1 = pc.addTrack(
                VideoTransformTrack(
                    cont,
                    relay.subscribe(track), transform="edges"
                ))

            print('track received track.kind=video ', track)

        @track.on("ended")
        async def on_ended():
            print("Track %s ended", track.kind)

    # handle offer

    await pc.setRemoteDescription(offer)

    # send answer
    answer = await pc.createAnswer()

    print(answer.sdp)

    await pc.setLocalDescription(answer)
    await sio.emit('call-started', data=asdict(pc.localDescription), to=sid)

    # New offer for a new Track

    @sio.on('get-new-track')
    async def get_new_track(sid, data):
        
        pc.addTrack(
            MediaPlayer("Cat.mp4").video
        )
        new_offer = await pc.createOffer()
        await pc.setLocalDescription(new_offer)
        print('new_offer', new_offer.sdp)
        await sio.emit('new-call-started', data=asdict(pc.localDescription), to=sid)

        @sio.on('last_answer')
        async def last_answer(sid, data):
            print('new_answer received ', data["sdp"])
            answerDescription = RTCSessionDescription(
                data["sdp"], data["type"])
            await pc.setRemoteDescription(answerDescription)

    @sio.on('change-track')
    async def change_track(sid):
        print('setting track', sid)
        videoObj = VideoDeFicheroSinTrack('Cat.mp4')
        print('PC', pc)
        print('entra')
        senders = []
        
        for sender in pc.getSenders():
        #     # print('sender encontrado: ', sender)
        #     # sender.replaceTrack(videoObj)
            senders.append(sender)
        #     sender.replaceTrack(videoObj)
        # print('videoObject --> ',videoObj.kind)
        # s1.replaceTrack(videoObj)
        # print(s1.replaceTrack(videoObj))
    
        # for sender in pc.getSenders():
        #     # sender.replaceTrack(videoObj)
        #     print('sender encontrado: ',   sender.replaceTrack(videoObj))
       
       
        await senders[2].stop()
        senderStopped = senders[2].track
        await sio.emit('senderstopped', data=senderStopped, to=sid)
        print('senerstopped')

        # for t in pc.getTransceivers():
        #     print('transceivers : ', t)
        #     if videoObj != None  and videoObj.kind == t.kind :
        #         senders[2].replaceTrack(videoObj)
        #         print('holaaaaaaaaaaaaaaaaaaaaaaa')
        #         if t.stop is True:
        #             print('error transceiver stopped')

        #     else:
        #         print('error')

async def on_shutdown(app):
    # close peer connections
    coros = [pc.close() for pc in pcs]
    await asyncio.gather(*coros)
    pcs.clear()


if __name__ == "__main__":

    # ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    # ssl_context.load_cert_chain(certfile="certificate.pem",keyfile="private-key.pem")

    # web.run_app(app, host="localhost", port=8080, ssl_context=ssl_context)
    web.run_app(app, host="localhost", port=8080)

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------------
    // 1. DOM 엘리먼트 초기화
    // --------------------------------------------------------
    const $video = document.getElementById('video');
    const $canvas = document.getElementById('canvas');
    const $photo = document.getElementById('photo');

    const $searchPage = document.getElementById('searchPage');
    const $settingsPage = document.getElementById('settingsPage');
    const $cameraPage = document.getElementById('cameraPage');

    const $searchInput = document.getElementById('searchInput');
    const $searchBtn = document.getElementById('searchBtn');
    const $imageSearchContainer = document.getElementById('imageSearchContainer');
    const $searchResultMessage = document.getElementById('searchResultMessage');

    // 새로 추가된 필터 DOM
    const $ddcSelect = document.getElementById('ddcSelect');
    const $sortBySelect = document.getElementById('sortBySelect');
    const $sortOrderToggle = document.getElementById('sortOrderToggle');

    const $startCameraBtn = document.getElementById('startCameraBtn');
    const $settingsBtn = document.getElementById('settingsBtn');
    const $backBtn = document.getElementById('backBtn');
    const $closeCameraBtn = document.getElementById('closeCameraBtn');
    const $captureBtn = document.getElementById('captureBtn');
    const $retryBtn = document.getElementById('retryBtn');

    // 초기 상태 셋팅
    stopCamera();
    $cameraPage.style.display = 'none';
    $imageSearchContainer.style.display = 'block'; // 이미지 검색 영역 보이기

    // --------------------------------------------------------
    // 2. 화면 전환 이벤트
    // --------------------------------------------------------
    $settingsBtn.addEventListener('click', () => {
        $searchPage.classList.remove('active');
        $searchPage.style.display = 'none';
        $settingsPage.classList.add('active');
        $settingsPage.style.display = 'block';
        $settingsBtn.style.display = 'none';
    });

    $backBtn.addEventListener('click', () => {
        $settingsPage.classList.remove('active');
        $settingsPage.style.display = 'none';
        $searchPage.classList.add('active');
        $searchPage.style.display = 'block';
        $settingsBtn.style.display = 'flex';
    });

    // --------------------------------------------------------
    // 3. 필터/정렬 토글 로직
    // --------------------------------------------------------
    $sortOrderToggle.addEventListener('click', () => {
        const currentOrder = $sortOrderToggle.getAttribute('data-order');
        if (currentOrder === 'asc') {
            $sortOrderToggle.setAttribute('data-order', 'desc');
            $sortOrderToggle.textContent = '내림차순 ▼';
        } else {
            $sortOrderToggle.setAttribute('data-order', 'asc');
            $sortOrderToggle.textContent = '오름차순 ▲';
        }
    });

    // --------------------------------------------------------
    // 4. 텍스트 도서 검색 기능 (백엔드 연동)
    // --------------------------------------------------------
    async function executeSearch() {
        const query = $searchInput.value.trim();
        const ddc = $ddcSelect.value;
        const sort = $sortBySelect.value;
        const order = $sortOrderToggle.getAttribute('data-order');

        if (!query) {
            alert('검색어를 입력해주세요.');
            return;
        }

        $searchResultMessage.textContent = '검색 중입니다...';

        try {
            // URL 파라미터 구성
            const params = new URLSearchParams({
                q: query,
                sort: sort,
                order: order
            });
            // 분류 전체가 아닐 때만 ddc 파라미터 추가
            if (ddc !== "") {
                params.append('ddc', ddc);
            }

            // 백엔드 API 연동
            const response = await fetch(`/api/books?${params.toString()}`);
            if (!response.ok) throw new Error('서버 응답 오류');

            const data = await response.json();

            if (data.total_count > 0) {
                $searchResultMessage.textContent = `총 ${data.total_count}권의 도서가 검색되었습니다.`;
                // TODO: 검색된 책 목록(data.books)을 UI에 렌더링하는 코드 추가
                console.log('검색된 책 목록:', data.books);
            } else {
                $searchResultMessage.textContent = '검색 결과가 없습니다.';
            }
        } catch (error) {
            console.error('검색 오류:', error);
            $searchResultMessage.textContent = '검색 중 오류가 발생했습니다.';
        }
    }

    $searchBtn.addEventListener('click', executeSearch);
    $searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') executeSearch();
    });

    // --------------------------------------------------------
    // 5. 카메라 제어 (비율 및 해상도 최적화)
    // --------------------------------------------------------
    function stopCamera() {
        if ($video.srcObject) {
            $video.srcObject.getTracks().forEach(track => track.stop());
            $video.srcObject = null;
        }
    }

    async function connectCamera() {
        stopCamera();
        const isPortrait = window.innerHeight > window.innerWidth;
        let longSideRatio = isPortrait ? window.innerHeight / window.innerWidth : window.innerWidth / window.innerHeight;

        const MAX_RATIO = 16 / 9;
        if (longSideRatio > MAX_RATIO) longSideRatio = MAX_RATIO;

        const targetAspectRatio = isPortrait ? (1 / longSideRatio) : longSideRatio;
        const baseShortSide = 1080;
        const baseLongSide = Math.round(baseShortSide * longSideRatio);

        const targetWidth = isPortrait ? baseShortSide : baseLongSide;
        const targetHeight = isPortrait ? baseLongSide : baseShortSide;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: targetWidth },
                    height: { ideal: targetHeight },
                    aspectRatio: { ideal: targetAspectRatio }
                },
                audio: false,
            });

            $video.srcObject = stream;
            $video.style.display = 'block';
            $photo.style.display = 'none';
            $captureBtn.style.display = 'block';
            $retryBtn.style.display = 'none';

        } catch (error) {
            console.error('카메라 연동 실패:', error);
            alert('카메라 접근 권한이 필요하거나 기기에서 카메라를 지원하지 않습니다.');
        }

    }

    function openCameraFullscreen() {
        $cameraPage.style.display = 'flex'; // 가운데 정렬을 위해 flex 유지
        connectCamera();
    }

    function closeCameraFullscreen() {
        $cameraPage.style.display = 'none';
        stopCamera();
    }

    $startCameraBtn.addEventListener('click', openCameraFullscreen);
    $closeCameraBtn.addEventListener('click', closeCameraFullscreen);
    $retryBtn.addEventListener('click', connectCamera);

    // 화면 회전 시 카메라 해상도 재계산
    window.addEventListener('orientationchange', () => {
        if ($cameraPage.style.display === 'flex' || $cameraPage.style.display === 'block') {
            setTimeout(connectCamera, 300);
        }
    });

    // --------------------------------------------------------
    // 6. 이미지 캡처 및 서버 전송 기능 (/api/scan)
    // --------------------------------------------------------
    async function handleCapture() {
        const context = $canvas.getContext('2d');
        if (!context || !$video.videoWidth || !$video.videoHeight) return;

        // 실제 비디오 스트림의 원본 픽셀 해상도를 캔버스 크기로 설정
        $canvas.width = $video.videoWidth;
        $canvas.height = $video.videoHeight;

        // 비디오 프레임 그리기
        context.drawImage($video, 0, 0, $canvas.width, $canvas.height);

        // 이미지 변환 (JPG 포맷으로 용량/속도 최적화)
        const dataUrl = $canvas.toDataURL('image/jpeg', 0.8);
        $photo.src = dataUrl;

        $video.style.display = 'none';
        $photo.style.display = 'block';
        $captureBtn.style.display = 'none';
        $retryBtn.style.display = 'block';

        stopCamera();
        closeCameraFullscreen(); // 촬영 완료 후 카메라 창 닫기

        await uploadScannedImage(dataUrl);
    }

    $captureBtn.addEventListener('click', handleCapture);

    async function uploadScannedImage(dataUrl) {
        $searchResultMessage.textContent = '이미지를 분석하는 중입니다...';
        try {
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            const formData = new FormData();
            formData.append('-F', blob, 'scan_image.jpg'); // 서버 스펙에 맞게 필드명 유지

            const apiResponse = await fetch('/api/scan', {
                method: 'POST',
                body: formData
            });

            if (!apiResponse.ok) throw new Error(`서버 응답 오류: ${apiResponse.status}`);

            const data = await apiResponse.json();
            console.log('스캔 결과:', data);

            if (data.found && data.book_info) {
                $searchResultMessage.textContent = `찾은 도서: ${data.book_info.title} (${data.book_info.author || '저자 미상'})`;
            } else {
                $searchResultMessage.textContent = data.message || '이미지에서 도서를 인식하지 못했습니다.';
            }

        } catch (error) {
            console.error('이미지 업로드/분석 오류:', error);
            $searchResultMessage.textContent = '스캔 처리 중 오류가 발생했습니다.';
        }
    }
});
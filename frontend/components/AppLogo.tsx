import React from 'react';
import { Image } from 'react-native';

const SOURCE = require('../assets/images/piclearn-horizontal-logo.png');

interface Props {
    width?: number;
    height?: number;
}

export function AppLogo({ width = 240, height = 80 }: Props) {
    return (
        <Image
            source={SOURCE}
            style={{ width, height }}
            resizeMode="contain"
        />
    );
}
